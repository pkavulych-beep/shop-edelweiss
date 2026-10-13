import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentStatus } from '../order/paymentEnum';
import { Status } from '../order/statusEnum';
import { CreateInvoiceInput, WebhookEvent } from './providers/payment-provider.interface';
import { PaymentEntity, PaymentLogKind } from './entities/payment.entity';
import { OrderEntity } from '../order/entities/order.entity';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepository: any;
  let orderRepository: any;
  let orderService: any;
  let paymentProvider: any;
  let manager: any;

  const mockOrder = {
    id: 10,
    user: { id: 3 },
    total: 1500,
    status: Status.Processed,
    paymentMethod: 'CARD',
    paymentStatus: PaymentStatus.NotRequired,
    paymentInvoiceId: null,
    paidAt: null,
  };

  const mockUser = { id: 3, roles: [{ value: 'USER' }] };

  beforeEach(() => {
    manager = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_entity, data) => ({ ...data })),
      save: jest.fn((_entity, data) => Promise.resolve(data)),
    };
    paymentRepository = {
      create: jest.fn().mockReturnValue({ id: 1 }),
      save: jest.fn().mockResolvedValue({ id: 1 }),
      findOne: jest.fn().mockResolvedValue(null),
      manager: { transaction: jest.fn((cb) => cb(manager)) },
    };
    orderRepository = {
      findOne: jest.fn().mockResolvedValue({ ...mockOrder }),
      save: jest.fn().mockResolvedValue({ ...mockOrder }),
    };
    orderService = {
      findOneForUser: jest.fn().mockResolvedValue({ ...mockOrder }),
    };
    process.env.BASE_URL = 'http://localhost:7777/';
    process.env.FRONTEND_URL = 'http://localhost:3000/';
    paymentProvider = {
      createInvoice: jest.fn().mockResolvedValue({
        invoiceId: 'mono-invoice-123',
        pageUrl: 'https://mono.com/invoice/mono-invoice-123',
      }),
      refund: jest.fn().mockResolvedValue(undefined),
      verifyWebhook: jest.fn(),
    };

    service = new PaymentService(
      paymentRepository,
      orderRepository,
      orderService,
      paymentProvider,
    );
  });

  describe('createInvoice', () => {
    it('creates invoice and returns pageUrl', async () => {
      const result = await service.createInvoice(3, 10);

      expect(orderService.findOneForUser).toHaveBeenCalledWith(10, mockUser);
      expect(paymentProvider.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 150000,
          ccy: 980,
          reference: '10',
        }),
      );
      expect(orderRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentInvoiceId: 'mono-invoice-123',
          paymentStatus: PaymentStatus.Pending,
        }),
      );
      expect(paymentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 10,
          provider: 'mono',
          invoiceId: 'mono-invoice-123',
          kind: PaymentLogKind.Invoice,
          amount: 150000,
          status: PaymentStatus.Pending,
        }),
      );
      expect(result).toEqual({ pageUrl: 'https://mono.com/invoice/mono-invoice-123' });
    });

    it('takes amount from order.total in database, not from request', async () => {
      await service.createInvoice(3, 10);

      const createInvoiceCall = paymentProvider.createInvoice.mock.calls[0][0] as CreateInvoiceInput;
      expect(createInvoiceCall.amount).toBe(150000);
      expect(createInvoiceCall.ccy).toBe(980);
    });

    it('redirects to the existing orders page without a double slash', async () => {
      await service.createInvoice(3, 10);

      const createInvoiceCall = paymentProvider.createInvoice.mock.calls[0][0] as CreateInvoiceInput;
      expect(createInvoiceCall.redirectUrl).toBe('http://localhost:3000/orders');
      expect(createInvoiceCall.webHookUrl).toBe('http://localhost:7777/payment/webhook/mono');
    });

    it('throws ForbiddenException when another user tries to create invoice', async () => {
      orderService.findOneForUser.mockRejectedValueOnce(new ForbiddenException());

      await expect(service.createInvoice(4, 10)).rejects.toBeInstanceOf(ForbiddenException);
      expect(paymentProvider.createInvoice).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when payment method is not CARD', async () => {
      orderService.findOneForUser.mockResolvedValueOnce({
        ...mockOrder,
        paymentMethod: 'COD',
      });

      await expect(service.createInvoice(3, 10)).rejects.toBeInstanceOf(BadRequestException);
      expect(paymentProvider.createInvoice).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when order is already paid', async () => {
      orderService.findOneForUser.mockResolvedValueOnce({
        ...mockOrder,
        paymentStatus: PaymentStatus.Paid,
      });

      await expect(service.createInvoice(3, 10)).rejects.toBeInstanceOf(BadRequestException);
      expect(paymentProvider.createInvoice).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for a canceled order', async () => {
      orderService.findOneForUser.mockResolvedValueOnce({
        ...mockOrder,
        status: Status.Canceled,
      });

      await expect(service.createInvoice(3, 10)).rejects.toBeInstanceOf(BadRequestException);
      expect(paymentProvider.createInvoice).not.toHaveBeenCalled();
    });

    it('returns the stored pageUrl while the invoice is still pending', async () => {
      orderService.findOneForUser.mockResolvedValueOnce({
        ...mockOrder,
        paymentStatus: PaymentStatus.Pending,
        paymentInvoiceId: 'mono-invoice-123',
      });
      paymentRepository.findOne.mockResolvedValueOnce({
        invoiceId: 'mono-invoice-123',
        rawPayload: { pageUrl: 'https://mono.com/invoice/mono-invoice-123' },
      });

      const result = await service.createInvoice(3, 10);

      expect(result).toEqual({ pageUrl: 'https://mono.com/invoice/mono-invoice-123' });
      expect(paymentProvider.createInvoice).not.toHaveBeenCalled();
    });

    it('creates a new invoice after the previous one FAILED', async () => {
      orderService.findOneForUser.mockResolvedValueOnce({
        ...mockOrder,
        paymentStatus: PaymentStatus.Failed,
        paymentInvoiceId: 'failed-invoice',
      });

      const result = await service.createInvoice(3, 10);

      expect(paymentProvider.createInvoice).toHaveBeenCalled();
      expect(orderRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentInvoiceId: 'mono-invoice-123',
          paymentStatus: PaymentStatus.Pending,
        }),
      );
      expect(result).toEqual({ pageUrl: 'https://mono.com/invoice/mono-invoice-123' });
    });

    it('throws BadRequestException when invoice already exists', async () => {
      orderService.findOneForUser.mockResolvedValueOnce({
        ...mockOrder,
        paymentInvoiceId: 'existing-invoice',
      });

      await expect(service.createInvoice(3, 10)).rejects.toBeInstanceOf(BadRequestException);
      expect(paymentProvider.createInvoice).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when BASE_URL is not configured', async () => {
      delete process.env.BASE_URL;

      await expect(service.createInvoice(3, 10)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('throws InternalServerErrorException when FRONTEND_URL is not configured', async () => {
      delete process.env.FRONTEND_URL;

      await expect(service.createInvoice(3, 10)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('refund', () => {
    const paidLog = () => ({
      id: 1,
      invoiceId: 'mono-invoice-123',
      orderId: 10,
      amount: 150000,
      status: PaymentStatus.Paid,
      rawPayload: { amount: 150000, ccy: 980 },
    });

    it('fully refunds a paid payment and marks log and order as REFUNDED', async () => {
      paymentRepository.findOne.mockResolvedValueOnce(paidLog());
      orderRepository.findOne.mockResolvedValueOnce({
        ...mockOrder,
        paymentStatus: PaymentStatus.Paid,
      });

      await service.refund('mono-invoice-123');

      // Для повного повернення провайдеру передається залишок (тут — уся сума).
      expect(paymentProvider.refund).toHaveBeenCalledWith({
        invoiceId: 'mono-invoice-123',
        amount: 150000,
      });
      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.Refunded,
          rawPayload: expect.objectContaining({ refundedAmount: 150000 }),
        }),
      );
      expect(orderRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ paymentStatus: PaymentStatus.Refunded }),
      );
    });

    it('throws NotFoundException when payment log not found', async () => {
      paymentRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.refund('non-existent')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a refund for a payment that is not PAID', async () => {
      paymentRepository.findOne.mockResolvedValueOnce({
        ...paidLog(),
        status: PaymentStatus.Pending,
      });

      await expect(service.refund('mono-invoice-123')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(paymentProvider.refund).not.toHaveBeenCalled();
    });

    it('rejects a refund larger than the remaining amount', async () => {
      paymentRepository.findOne.mockResolvedValueOnce(paidLog());

      await expect(service.refund('mono-invoice-123', 200000)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(paymentProvider.refund).not.toHaveBeenCalled();
    });

    it('rejects a partial refund that exceeds what is left after earlier refunds', async () => {
      paymentRepository.findOne.mockResolvedValueOnce({
        ...paidLog(),
        rawPayload: { amount: 150000, ccy: 980, refundedAmount: 100000 },
      });

      await expect(service.refund('mono-invoice-123', 100000)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(paymentProvider.refund).not.toHaveBeenCalled();
    });

    it('keeps a partial refund PAID and records the refunded amount', async () => {
      paymentRepository.findOne.mockResolvedValueOnce(paidLog());
      orderRepository.findOne.mockResolvedValueOnce({
        ...mockOrder,
        paymentStatus: PaymentStatus.Paid,
      });

      await service.refund('mono-invoice-123', 50000);

      expect(paymentProvider.refund).toHaveBeenCalledWith({
        invoiceId: 'mono-invoice-123',
        amount: 50000,
      });
      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.Paid,
          rawPayload: expect.objectContaining({ refundedAmount: 50000 }),
        }),
      );
      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('marks the payment REFUNDED once two partial refunds add up to the full amount', async () => {
      paymentRepository.findOne.mockResolvedValueOnce(paidLog());
      orderRepository.findOne.mockResolvedValueOnce({
        ...mockOrder,
        paymentStatus: PaymentStatus.Paid,
      });
      await service.refund('mono-invoice-123', 75000);

      expect(paymentRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: PaymentStatus.Paid,
          rawPayload: expect.objectContaining({ refundedAmount: 75000 }),
        }),
      );
      expect(orderRepository.save).not.toHaveBeenCalled();

      // Друге повернення бачить уже повернуті 75000 і повертає лише залишок.
      paymentRepository.findOne.mockResolvedValueOnce({
        ...paidLog(),
        rawPayload: { amount: 150000, ccy: 980, refundedAmount: 75000 },
      });
      orderRepository.findOne.mockResolvedValueOnce({
        ...mockOrder,
        paymentStatus: PaymentStatus.Paid,
      });
      await service.refund('mono-invoice-123');

      expect(paymentProvider.refund).toHaveBeenLastCalledWith({
        invoiceId: 'mono-invoice-123',
        amount: 75000,
      });
      expect(paymentRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: PaymentStatus.Refunded,
          rawPayload: expect.objectContaining({ refundedAmount: 150000 }),
        }),
      );
      expect(orderRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ paymentStatus: PaymentStatus.Refunded }),
      );
    });
  });

  describe('handleWebhook', () => {
    const T1 = new Date('2026-10-13T10:00:00Z');
    const T2 = new Date('2026-10-13T10:05:00Z');
    const input = { rawBody: Buffer.from('{}'), signature: 'sig' };

    const event = (overrides: Partial<WebhookEvent> = {}): WebhookEvent => ({
      invoiceId: 'mono-invoice-123',
      status: PaymentStatus.Paid,
      amount: 150000,
      ccy: 980,
      modifiedDate: T1,
      payload: { invoiceId: 'mono-invoice-123', status: 'success' },
      ...overrides,
    });

    let invoiceLog: any;
    let order: any;

    beforeEach(() => {
      invoiceLog = {
        id: 1,
        orderId: 10,
        provider: 'mono',
        invoiceId: 'mono-invoice-123',
        kind: PaymentLogKind.Invoice,
        amount: 150000,
        status: PaymentStatus.Pending,
        providerModifiedAt: null,
      };
      order = {
        ...mockOrder,
        paymentStatus: PaymentStatus.Pending,
        paymentInvoiceId: 'mono-invoice-123',
      };
      manager.findOne.mockImplementation((entity: unknown) =>
        Promise.resolve(entity === PaymentEntity ? invoiceLog : order),
      );
    });

    const savedOrders = () =>
      manager.save.mock.calls.filter(([entity]: [unknown]) => entity === OrderEntity);
    const journal = () =>
      manager.save.mock.calls.filter(
        ([entity, data]: [unknown, any]) =>
          entity === PaymentEntity && data.kind === PaymentLogKind.Webhook,
      );

    it('marks the order PAID with paidAt from a valid success webhook', async () => {
      paymentProvider.verifyWebhook.mockResolvedValueOnce(event());

      await service.handleWebhook(input);

      expect(paymentProvider.verifyWebhook).toHaveBeenCalledWith(input);
      expect(manager.findOne).toHaveBeenCalledWith(PaymentEntity, {
        where: { invoiceId: 'mono-invoice-123', kind: PaymentLogKind.Invoice },
        lock: { mode: 'pessimistic_write' },
      });
      expect(invoiceLog).toEqual(
        expect.objectContaining({ status: PaymentStatus.Paid, providerModifiedAt: T1 }),
      );
      expect(savedOrders()).toHaveLength(1);
      expect(order.paymentStatus).toBe(PaymentStatus.Paid);
      expect(order.paidAt).toEqual(T1);
    });

    it('writes every webhook to the journal with its raw payload', async () => {
      paymentProvider.verifyWebhook.mockResolvedValueOnce(event());

      await service.handleWebhook(input);

      expect(journal()).toHaveLength(1);
      expect(journal()[0][1]).toEqual(
        expect.objectContaining({
          orderId: 10,
          invoiceId: 'mono-invoice-123',
          kind: PaymentLogKind.Webhook,
          status: PaymentStatus.Paid,
          providerModifiedAt: T1,
          rawPayload: { invoiceId: 'mono-invoice-123', status: 'success' },
        }),
      );
    });

    it('changes nothing in the database when the signature is broken', async () => {
      paymentProvider.verifyWebhook.mockRejectedValueOnce(
        new BadRequestException('Підпис X-Sign не збігається'),
      );

      await expect(service.handleWebhook(input)).rejects.toBeInstanceOf(BadRequestException);
      expect(paymentRepository.manager.transaction).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
      expect(order.paymentStatus).toBe(PaymentStatus.Pending);
    });

    it('changes nothing in the database when X-Sign is missing', async () => {
      paymentProvider.verifyWebhook.mockRejectedValueOnce(
        new BadRequestException('Немає підпису X-Sign'),
      );

      await expect(
        service.handleWebhook({ rawBody: Buffer.from('{}'), signature: undefined }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('ignores a repeated delivery with the same modifiedDate', async () => {
      invoiceLog.status = PaymentStatus.Paid;
      invoiceLog.providerModifiedAt = T1;
      order.paymentStatus = PaymentStatus.Paid;
      order.paidAt = T1;
      paymentProvider.verifyWebhook.mockResolvedValueOnce(event());

      await service.handleWebhook(input);

      expect(journal()).toHaveLength(1);
      expect(savedOrders()).toHaveLength(0);
      expect(invoiceLog.providerModifiedAt).toBe(T1);
    });

    it('ignores a webhook older than the one already applied', async () => {
      invoiceLog.status = PaymentStatus.Paid;
      invoiceLog.providerModifiedAt = T2;
      order.paymentStatus = PaymentStatus.Paid;
      paymentProvider.verifyWebhook.mockResolvedValueOnce(
        event({ status: PaymentStatus.Failed, modifiedDate: T1 }),
      );

      await service.handleWebhook(input);

      expect(invoiceLog.status).toBe(PaymentStatus.Paid);
      expect(order.paymentStatus).toBe(PaymentStatus.Paid);
      expect(savedOrders()).toHaveLength(0);
    });

    it('treats a newer PAID → PAID webhook as a no-op for the order', async () => {
      invoiceLog.status = PaymentStatus.Paid;
      invoiceLog.providerModifiedAt = T1;
      order.paymentStatus = PaymentStatus.Paid;
      order.paidAt = T1;
      paymentProvider.verifyWebhook.mockResolvedValueOnce(event({ modifiedDate: T2 }));

      await service.handleWebhook(input);

      expect(invoiceLog.providerModifiedAt).toBe(T2);
      expect(savedOrders()).toHaveLength(0);
      expect(order.paidAt).toBe(T1);
    });

    it('does not mark PAID when the paid amount differs from the invoice', async () => {
      paymentProvider.verifyWebhook.mockResolvedValueOnce(event({ amount: 100 }));

      await service.handleWebhook(input);

      expect(invoiceLog.status).toBe(PaymentStatus.Pending);
      expect(order.paymentStatus).toBe(PaymentStatus.Pending);
      expect(savedOrders()).toHaveLength(0);
    });

    it('marks the order FAILED after a failure webhook', async () => {
      paymentProvider.verifyWebhook.mockResolvedValueOnce(
        event({ status: PaymentStatus.Failed }),
      );

      await service.handleWebhook(input);

      expect(order.paymentStatus).toBe(PaymentStatus.Failed);
      expect(order.paidAt).toBeNull();
    });

    it('does not let a failure un-pay a paid order', async () => {
      invoiceLog.status = PaymentStatus.Paid;
      invoiceLog.providerModifiedAt = T1;
      order.paymentStatus = PaymentStatus.Paid;
      paymentProvider.verifyWebhook.mockResolvedValueOnce(
        event({ status: PaymentStatus.Failed, modifiedDate: T2 }),
      );

      await service.handleWebhook(input);

      expect(order.paymentStatus).toBe(PaymentStatus.Paid);
      expect(savedOrders()).toHaveLength(0);
    });

    it('marks a paid order REFUNDED after a reversed webhook', async () => {
      invoiceLog.status = PaymentStatus.Paid;
      invoiceLog.providerModifiedAt = T1;
      order.paymentStatus = PaymentStatus.Paid;
      paymentProvider.verifyWebhook.mockResolvedValueOnce(
        event({ status: PaymentStatus.Refunded, modifiedDate: T2 }),
      );

      await service.handleWebhook(input);

      expect(invoiceLog.status).toBe(PaymentStatus.Refunded);
      expect(order.paymentStatus).toBe(PaymentStatus.Refunded);
    });

    it('does not touch the order when the webhook is for its previous invoice', async () => {
      order.paymentInvoiceId = 'newer-invoice';
      paymentProvider.verifyWebhook.mockResolvedValueOnce(
        event({ status: PaymentStatus.Failed }),
      );

      await service.handleWebhook(input);

      expect(invoiceLog.status).toBe(PaymentStatus.Failed);
      expect(savedOrders()).toHaveLength(0);
    });

    it('saves nothing for an unknown invoice', async () => {
      invoiceLog = null;
      paymentProvider.verifyWebhook.mockResolvedValueOnce(event());

      await service.handleWebhook(input);

      expect(manager.save).not.toHaveBeenCalled();
    });
  });
});
