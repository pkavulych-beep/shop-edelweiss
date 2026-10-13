import * as request from 'supertest';
import { generateKeyPairSync, sign } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentController } from '../src/payment/payment.controller';
import { PaymentService } from '../src/payment/payment.service';
import { MonoPaymentProvider } from '../src/payment/providers/mono.provider';
import { PaymentEntity, PaymentLogKind } from '../src/payment/entities/payment.entity';
import { OrderEntity } from '../src/order/entities/order.entity';
import { OrderService } from '../src/order/order.service';
import { PaymentStatus } from '../src/order/paymentEnum';

// Повний HTTP-шлях вебхука: rawBody і глобальний ValidationPipe, як у main.ts,
// справжня перевірка підпису mono (ключ закріплено через MONO_PUBLIC_KEY),
// а замість бази — мок EntityManager.
describe('POST /payment/webhook/mono (e2e)', () => {
  let app: INestApplication;
  let invoiceLog: Record<string, unknown>;
  let order: Record<string, unknown>;
  const manager = {
    findOne: jest.fn(),
    create: jest.fn((_entity, data) => ({ ...data })),
    save: jest.fn((_entity, data) => Promise.resolve(data)),
  };

  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const body =
    '{ "invoiceId": "p2_9ZgpZVsl3", "status": "success", "amount": 150000, "ccy": 980,\n' +
    '  "modifiedDate": "2026-10-13T10:00:00Z", "unknownField": true }';
  const signature = sign('sha256', Buffer.from(body), privateKey).toString('base64');

  beforeAll(async () => {
    process.env.MONO_PUBLIC_KEY = Buffer.from(
      publicKey.export({ type: 'spki', format: 'pem' }) as string,
    ).toString('base64');

    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        PaymentService,
        { provide: 'PAYMENT_PROVIDER', useClass: MonoPaymentProvider },
        {
          provide: getRepositoryToken(PaymentEntity),
          useValue: { manager: { transaction: (cb) => cb(manager) } },
        },
        { provide: getRepositoryToken(OrderEntity), useValue: {} },
        { provide: OrderService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    invoiceLog = {
      orderId: 10,
      provider: 'mono',
      invoiceId: 'p2_9ZgpZVsl3',
      kind: PaymentLogKind.Invoice,
      amount: 150000,
      status: PaymentStatus.Pending,
      providerModifiedAt: null,
    };
    order = { id: 10, paymentStatus: PaymentStatus.Pending, paymentInvoiceId: 'p2_9ZgpZVsl3' };
    manager.findOne.mockImplementation((entity) =>
      Promise.resolve(entity === PaymentEntity ? invoiceLog : order),
    );
  });

  afterAll(async () => {
    delete process.env.MONO_PUBLIC_KEY;
    await app.close();
  });

  const post = (raw: string, sig?: string) => {
    const req = request(app.getHttpServer())
      .post('/payment/webhook/mono')
      .set('Content-Type', 'application/json');
    return (sig ? req.set('X-Sign', sig) : req).send(raw);
  };

  it('accepts a webhook signed over the raw body and marks the order PAID', async () => {
    await post(body, signature).expect(200).expect({ success: true });

    expect(order.paymentStatus).toBe(PaymentStatus.Paid);
    expect(order.paidAt).toEqual(new Date('2026-10-13T10:00:00Z'));
    // Невідомі поля не обрізаються: у журнал іде весь payload.
    expect(manager.save).toHaveBeenCalledWith(
      PaymentEntity,
      expect.objectContaining({
        kind: PaymentLogKind.Webhook,
        rawPayload: expect.objectContaining({ unknownField: true }),
      }),
    );
  });

  it('returns 400 and changes nothing for a broken signature', async () => {
    await post(body.replace('150000', '15'), signature).expect(400);

    expect(manager.findOne).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
    expect(order.paymentStatus).toBe(PaymentStatus.Pending);
  });

  it('returns 400 and changes nothing without X-Sign', async () => {
    await post(body).expect(400);

    expect(manager.save).not.toHaveBeenCalled();
    expect(order.paymentStatus).toBe(PaymentStatus.Pending);
  });

  it('answers 200 to a repeated delivery without changing the order again', async () => {
    await post(body, signature).expect(200);
    const paidAt = order.paidAt;
    manager.save.mockClear();

    await post(body, signature).expect(200);

    expect(manager.save).not.toHaveBeenCalledWith(OrderEntity, expect.anything());
    expect(order.paidAt).toBe(paidAt);
  });
});
