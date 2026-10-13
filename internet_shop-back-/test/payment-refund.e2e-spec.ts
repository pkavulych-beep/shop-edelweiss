import * as request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PaymentController } from '../src/payment/payment.controller';
import { PaymentService } from '../src/payment/payment.service';
import { RolesGuard } from '../src/auth/roles.guard';

// invoiceId у mono — рядок (наприклад, 'p2_9ZgpZVsl3'), тож :invoiceId не можна
// пропускати через ParseIdPipe. Тут проходить повний роутинг із глобальним
// ValidationPipe, як у main.ts.
describe('PaymentController refund (e2e)', () => {
  let app: INestApplication;
  const refund = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: { createInvoice: jest.fn(), refund },
        },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a non-numeric mono invoiceId', async () => {
    await request(app.getHttpServer())
      .post('/payment/p2_9ZgpZVsl3/refund')
      .send({})
      .expect(201)
      .expect({ success: true });

    expect(refund).toHaveBeenCalledWith('p2_9ZgpZVsl3', undefined);
  });

  it('rejects a non-integer refund amount with 400', async () => {
    await request(app.getHttpServer())
      .post('/payment/p2_9ZgpZVsl3/refund')
      .send({ amount: 'abc' })
      .expect(400);

    expect(refund).toHaveBeenCalledTimes(1);
  });
});
