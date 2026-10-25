import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { UsersService } from 'src/user/user.service';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

const SECRET = 'payment-http-spec-secret';

const usersService = { findById: jest.fn() };
const paymentService = {
  createInvoice: jest.fn(),
  refund: jest.fn(),
  getOrderPayment: jest.fn(),
};

// Той самий склад, що й у робочому застосунку: контролер, глобальна валідація
// та RolesGuard, який автентифікує запит через JwtStrategy.
@Module({
  imports: [PassportModule],
  controllers: [PaymentController],
  providers: [
    JwtStrategy,
    { provide: UsersService, useValue: usersService },
    { provide: PaymentService, useValue: paymentService },
    { provide: 'PAYMENT_PROVIDER', useValue: {} },
  ],
})
class TestPaymentModule {}

describe('PaymentController over HTTP', () => {
  const originalSecret = process.env.JWT_SECRET;
  const jwt = new JwtService({ secret: SECRET });
  const tokenFor = (id: number) =>
    `Bearer ${jwt.sign({ sub: id, phoneNumber: '380990000000' })}`;

  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;
    usersService.findById.mockResolvedValue({
      id: 1,
      password: 'secret',
      roles: [{ value: 'ADMIN' }],
    });

    const moduleRef = await Test.createTestingModule({
      imports: [TestPaymentModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  beforeEach(() => {
    usersService.findById.mockResolvedValue({
      id: 1,
      password: 'secret',
      roles: [{ value: 'ADMIN' }],
    });
    paymentService.getOrderPayment.mockReset().mockResolvedValue({
      invoiceId: 'mono-invoice-123',
      paidAt: new Date('2026-10-13T10:00:00Z'),
      amount: 150000,
      refundedAmount: 0,
      refundableAmount: 150000,
      history: [],
    });
  });

  afterAll(async () => {
    await app.close();
    process.env.JWT_SECRET = originalSecret;
  });

  it('gives an admin the payment details of an order', async () => {
    await request(app.getHttpServer())
      .get('/payment/order/10')
      .set({ Authorization: tokenFor(1) })
      .expect(200)
      .expect(res => {
        expect(res.body).toEqual(
          expect.objectContaining({
            invoiceId: 'mono-invoice-123',
            amount: 150000,
            refundableAmount: 150000,
          }),
        );
      });

    expect(paymentService.getOrderPayment).toHaveBeenCalledWith(10);
  });

  it('gives 403 to a regular user', async () => {
    usersService.findById.mockResolvedValue({
      id: 2,
      password: 'secret',
      roles: [{ value: 'USER' }],
    });

    await request(app.getHttpServer())
      .get('/payment/order/10')
      .set({ Authorization: tokenFor(2) })
      .expect(403);

    expect(paymentService.getOrderPayment).not.toHaveBeenCalled();
  });

  it('gives 401 without a token', async () => {
    await request(app.getHttpServer()).get('/payment/order/10').expect(401);

    expect(paymentService.getOrderPayment).not.toHaveBeenCalled();
  });

  it('answers 404 for an id outside the integer range instead of 500', async () => {
    await request(app.getHttpServer())
      .get('/payment/order/9999999999')
      .set({ Authorization: tokenFor(1) })
      .expect(404);

    expect(paymentService.getOrderPayment).not.toHaveBeenCalled();
  });
});
