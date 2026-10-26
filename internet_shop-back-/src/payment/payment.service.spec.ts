import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentMethod, PaymentStatus } from '../order/paymentEnum';
import { Status } from '../order/statusEnum';
import { CreateInvoiceInput, WebhookEvent } from './providers/payment-provider.interface';
import { PaymentEntity, PaymentLogKind } from './entities/payment.entity';
import { OrderEntity } from '../order/entities/order.entity';

const DEFAULT_PAYMENT_TIMEOUT_MINUTES = 60;
const STATUS_CHECK_GRACE_MINUTES = 5;

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

  describe('getMethods', () => {
    afterEach(() => {
      delete process.env.MONO_ACQUIRING_TOKEN;
    });

    it('reports card payment available when mono token and URLs are configured', () => {
      process.env.MONO_ACQUIRING_TOKEN = 'test-token';

      expect(service.getMethods()).toEqual({ card: true });
    });

    it('reports card payment unavailable without mono token', () => {
      delete process.env.MONO_ACQUIRING_TOKEN;

      expect(service.getMethods()).toEqual({ card: false });
    });

    it('reports card payment unavailable without BASE_URL', () => {
      process.env.MONO_ACQUIRING_TOKEN = 'test-token';
      delete process.env.BASE_URL;

      expect(service.getMethods()).toEqual({ card: false });
    });

    it('reports card payment unavailable without FRONTEND_URL', () => {
      process.env.MONO_ACQUIRING_TOKEN = 'test-token';
      delete process.env.FRONTEND_URL;

      expect(service.getMethods()).toEqual({ card: false });
    });
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

    it('redirects to the payment success page with orderId', async () => {
      await service.createInvoice(3, 10);

      const createInvoiceCall = paymentProvider.createInvoice.mock.calls[0][0] as CreateInvoiceInput;
      expect(createInvoiceCall.redirectUrl).toBe('http://localhost:3000/payment/success?orderId=10');
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

    it('throws BadRequestException for CARD order without invoice older than payment timeout', async () => {
      const OLD_DATE = new Date('2026-10-13T10:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-13T12:00:00Z').getTime());
      orderService.findOneForUser.mockResolvedValueOnce({
        ...mockOrder,
        createdAt: OLD_DATE,
        paymentInvoiceId: null,
        paymentStatus: PaymentStatus.NotRequired,
      });

      await expect(service.createInvoice(3, 10)).rejects.toBeInstanceOf(BadRequestException);
      expect(paymentProvider.createInvoice).not.toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('allows creating invoice for CARD order without invoice younger than payment timeout', async () => {
      const YOUNG_DATE = new Date('2026-10-13T11:30:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-13T12:00:00Z').getTime());
      orderService.findOneForUser.mockResolvedValueOnce({
        ...mockOrder,
        createdAt: YOUNG_DATE,
        paymentInvoiceId: null,
        paymentStatus: PaymentStatus.NotRequired,
      });

      await expect(service.createInvoice(3, 10)).resolves.toEqual({
        pageUrl: 'https://mono.com/invoice/mono-invoice-123',
      });
      expect(paymentProvider.createInvoice).toHaveBeenCalled();
      jest.restoreAllMocks();
    });
    it('creates a new invoice after FAILED even when the order is older than payment timeout', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-13T12:00:00Z').getTime());
      orderService.findOneForUser.mockResolvedValueOnce({
        ...mockOrder,
        createdAt: new Date('2026-10-13T10:00:00Z'),
        paymentInvoiceId: 'failed-invoice',
        paymentStatus: PaymentStatus.Failed,
      });

      await expect(service.createInvoice(3, 10)).resolves.toEqual({
        pageUrl: 'https://mono.com/invoice/mono-invoice-123',
      });
      expect(paymentProvider.createInvoice).toHaveBeenCalled();
      expect(orderRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentInvoiceId: 'mono-invoice-123',
          paymentStatus: PaymentStatus.Pending,
        }),
      );
      jest.restoreAllMocks();
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

  describe('getOrderPayment', () => {
    const T1 = new Date('2026-10-13T10:00:00Z');
    const T2 = new Date('2026-10-13T10:05:00Z');

    const invoiceLog = () => ({
      id: 1,
      orderId: 10,
      provider: 'mono',
      invoiceId: 'mono-invoice-123',
      kind: PaymentLogKind.Invoice,
      amount: 150000,
      status: PaymentStatus.Paid,
      createdAt: T1,
      rawPayload: { amount: 150000, ccy: 980, orderId: '10', pageUrl: 'https://mono.com/x' },
    });

    beforeEach(() => {
      paymentRepository.find = jest.fn().mockResolvedValue([]);
      orderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        paymentMethod: 'CARD',
        paymentStatus: PaymentStatus.Paid,
        paymentInvoiceId: 'mono-invoice-123',
        paidAt: T2,
      });
    });

    it('returns invoice, paidAt, amounts and the payment log history', async () => {
      paymentRepository.findOne.mockResolvedValueOnce({
        ...invoiceLog(),
        rawPayload: { ...invoiceLog().rawPayload, refundedAmount: 50000 },
      });
      paymentRepository.find.mockResolvedValueOnce([
        invoiceLog(),
        {
          id: 2,
          orderId: 10,
          provider: 'mono',
          invoiceId: 'mono-invoice-123',
          kind: PaymentLogKind.Webhook,
          amount: 150000,
          status: PaymentStatus.Paid,
          createdAt: T2,
          rawPayload: {
            invoiceId: 'mono-invoice-123',
            status: 'success',
            amount: 150000,
            failureReason: undefined,
            secret: 'must not leak',
          },
        },
      ]);

      const result = await service.getOrderPayment(10);

      expect(paymentRepository.find).toHaveBeenCalledWith({
        where: { orderId: 10 },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
      expect(result).toEqual({
        invoiceId: 'mono-invoice-123',
        paidAt: T2,
        amount: 150000,
        refundedAmount: 50000,
        refundableAmount: 100000,
        history: [
          {
            at: T1,
            kind: PaymentLogKind.Invoice,
            status: PaymentStatus.Paid,
            amount: 150000,
          },
          {
            at: T2,
            kind: PaymentLogKind.Webhook,
            status: PaymentStatus.Paid,
            amount: 150000,
            monoStatus: 'success',
          },
        ],
      });
      expect(JSON.stringify(result)).not.toContain('must not leak');
      expect(JSON.stringify(result)).not.toContain('rawPayload');
    });

    it('takes only the mono status and failureReason from the raw payload', async () => {
      paymentRepository.findOne.mockResolvedValueOnce(invoiceLog());
      paymentRepository.find.mockResolvedValueOnce([
        {
          id: 2,
          orderId: 10,
          provider: 'mono',
          invoiceId: 'mono-invoice-123',
          kind: PaymentLogKind.StatusCheck,
          amount: 150000,
          status: PaymentStatus.Failed,
          createdAt: T2,
          rawPayload: {
            status: 'failure',
            failureReason: 'insufficient_funds',
            rrn: '123456789',
            cardMask: '444455******1111',
          },
        },
      ]);

      const [entry] = (await service.getOrderPayment(10)).history;

      expect(entry).toEqual({
        at: T2,
        kind: PaymentLogKind.StatusCheck,
        status: PaymentStatus.Failed,
        amount: 150000,
        monoStatus: 'failure',
        failureReason: 'insufficient_funds',
      });
      expect(entry).not.toHaveProperty('rawPayload');
      expect(entry).not.toHaveProperty('rrn');
      expect(entry).not.toHaveProperty('cardMask');
    });

    it('returns an empty history and no amount for an order without an invoice', async () => {
      orderRepository.findOne.mockResolvedValueOnce({
        ...mockOrder,
        paymentMethod: 'COD',
        paymentInvoiceId: null,
        paidAt: null,
      });

      const result = await service.getOrderPayment(10);

      expect(paymentRepository.findOne).not.toHaveBeenCalled();
      expect(result).toEqual({
        invoiceId: null,
        paidAt: null,
        amount: null,
        refundedAmount: 0,
        refundableAmount: 0,
        history: [],
      });
    });

    it('throws NotFoundException for an unknown order', async () => {
      orderRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.getOrderPayment(999)).rejects.toBeInstanceOf(NotFoundException);
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

  describe('reconcilePendingCardPayments', () => {
    const NOW = new Date('2026-10-13T12:00:00Z');
    const INVOICE_ID = 'mono-invoice-123';
    const invoiceCreatedAt = new Date('2026-10-13T10:00:00Z');
    const status = (overrides: Record<string, unknown> = {}) => ({
      invoiceId: INVOICE_ID,
      status: 'success',
      amount: 150000,
      ccy: 980,
      modifiedDate: '2026-10-13T11:00:00Z',
      ...overrides,
    });

    let invoiceLog: any;
    let order: any;

    const givenInvoice = (createdAt = invoiceCreatedAt) => ({
      id: 1,
      orderId: 10,
      provider: 'mono',
      invoiceId: INVOICE_ID,
      kind: PaymentLogKind.Invoice,
      amount: 150000,
      status: PaymentStatus.Pending,
      providerModifiedAt: null,
      createdAt,
    });

    const statusLogs = () =>
      manager.save.mock.calls.filter(
        ([entity, data]: [unknown, any]) =>
          entity === PaymentEntity && data.kind === PaymentLogKind.StatusCheck,
      );

    beforeEach(() => {
      process.env.MONO_ACQUIRING_TOKEN = 'test-token';
      jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());

      invoiceLog = givenInvoice();
      order = {
        ...mockOrder,
        paymentStatus: PaymentStatus.Pending,
        paymentInvoiceId: INVOICE_ID,
      };

      paymentRepository.find = jest.fn().mockResolvedValue([invoiceLog]);
      orderRepository.find = jest.fn().mockResolvedValue([]);
      orderRepository.findOne.mockResolvedValue(order);
      manager.findOne.mockImplementation((entity: unknown) =>
        Promise.resolve(entity === PaymentEntity ? invoiceLog : order),
      );
      paymentProvider.getInvoiceStatus = jest
        .fn()
        .mockResolvedValue(status());
      paymentProvider.invalidateInvoice = jest.fn().mockResolvedValue(undefined);
      orderService.cancelUnpaidOrder = jest.fn().mockImplementation(async () => {
        order.status = Status.Canceled;
        order.paymentStatus = PaymentStatus.Failed;
        return order;
      });
      orderService.cancelOrderWithoutInvoice = jest.fn().mockImplementation(async () => {
        order.status = Status.Canceled;
        order.paymentStatus = PaymentStatus.Failed;
        return order;
      });
    });

    afterEach(() => {
      delete process.env.MONO_ACQUIRING_TOKEN;
      jest.restoreAllMocks();
    });

    it('marks a successful invoice PAID and paidAt when the webhook was lost', async () => {
      await service.reconcilePendingCardPayments();

      expect(paymentProvider.getInvoiceStatus).toHaveBeenCalledWith(INVOICE_ID);
      expect(invoiceLog.status).toBe(PaymentStatus.Paid);
      expect(order.paymentStatus).toBe(PaymentStatus.Paid);
      expect(order.paidAt).toEqual(new Date('2026-10-13T11:00:00Z'));
      expect(statusLogs()).toHaveLength(1);
      expect(statusLogs()[0][1]).toEqual(
        expect.objectContaining({
          kind: PaymentLogKind.StatusCheck,
          status: PaymentStatus.Paid,
        }),
      );
    });

    it('cancels an expired invoice, marks it FAILED and returns stock', async () => {
      paymentProvider.getInvoiceStatus.mockResolvedValueOnce(status({ status: 'expired' }));

      await service.reconcilePendingCardPayments();

      expect(orderService.cancelUnpaidOrder).toHaveBeenCalledWith(
        manager,
        10,
        INVOICE_ID,
      );
      expect(invoiceLog.status).toBe(PaymentStatus.Failed);
      expect(order.status).toBe(Status.Canceled);
      expect(order.paymentStatus).toBe(PaymentStatus.Failed);
      expect(statusLogs()).toHaveLength(1);
      expect(statusLogs()[0][1]).toEqual(
        expect.objectContaining({ status: PaymentStatus.Failed }),
      );
    });

    it('cancels an unpaid invoice after failure as well', async () => {
      paymentProvider.getInvoiceStatus.mockResolvedValueOnce(status({ status: 'failure' }));

      await service.reconcilePendingCardPayments();

      expect(orderService.cancelUnpaidOrder).toHaveBeenCalled();
      expect(invoiceLog.status).toBe(PaymentStatus.Failed);
    });

    it('removes a still-created invoice before cancelling the order', async () => {
      paymentProvider.getInvoiceStatus.mockResolvedValueOnce(status({ status: 'created' }));

      await service.reconcilePendingCardPayments();

      expect(paymentProvider.invalidateInvoice).toHaveBeenCalledWith(INVOICE_ID);
      expect(orderService.cancelUnpaidOrder).toHaveBeenCalled();
      // remove — строго до скасування, щоб рахунок уже не можна було оплатити.
      expect(paymentProvider.invalidateInvoice.mock.invocationCallOrder[0]).toBeLessThan(
        (orderService.cancelUnpaidOrder as jest.Mock).mock.invocationCallOrder[0],
      );
      expect(invoiceLog.status).toBe(PaymentStatus.Failed);
    });

    it('does nothing while the invoice is still processing', async () => {
      paymentProvider.getInvoiceStatus.mockResolvedValueOnce(status({ status: 'processing' }));

      await service.reconcilePendingCardPayments();

      expect(orderService.cancelUnpaidOrder).not.toHaveBeenCalled();
      expect(paymentProvider.invalidateInvoice).not.toHaveBeenCalled();
      expect(invoiceLog.status).toBe(PaymentStatus.Pending);
      expect(order.paymentStatus).toBe(PaymentStatus.Pending);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('does nothing when mono returns an error', async () => {
      paymentProvider.getInvoiceStatus.mockRejectedValueOnce(
        new InternalServerErrorException('Mono API error: 429'),
      );

      await expect(service.reconcilePendingCardPayments()).resolves.toBeUndefined();

      expect(orderService.cancelUnpaidOrder).not.toHaveBeenCalled();
      expect(invoiceLog.status).toBe(PaymentStatus.Pending);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('does not overwrite an order already PAID by a webhook', async () => {
      order.paymentStatus = PaymentStatus.Paid;
      order.paidAt = new Date('2026-10-13T10:30:00Z');
      paymentProvider.getInvoiceStatus.mockResolvedValueOnce(status({ status: 'expired' }));

      await service.reconcilePendingCardPayments();

      expect(orderService.cancelUnpaidOrder).not.toHaveBeenCalled();
      expect(order.paymentStatus).toBe(PaymentStatus.Paid);
      expect(invoiceLog.status).toBe(PaymentStatus.Pending);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('does not ask mono about invoices younger than the timeout', async () => {
      const fresh = givenInvoice(new Date('2026-10-13T11:30:00Z'));
      paymentRepository.find.mockResolvedValueOnce([]);

      await service.reconcilePendingCardPayments();

      expect(paymentRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            kind: PaymentLogKind.Invoice,
            status: PaymentStatus.Pending,
          }),
        }),
      );
      const where = paymentRepository.find.mock.calls[0][0].where;
      expect(where.createdAt.value).toEqual(new Date('2026-10-13T10:55:00Z'));
      expect(fresh.createdAt.getTime()).toBeGreaterThan(where.createdAt.value.getTime());
      expect(paymentProvider.getInvoiceStatus).not.toHaveBeenCalled();
    });

    it('does nothing without MONO_ACQUIRING_TOKEN', async () => {
      delete process.env.MONO_ACQUIRING_TOKEN;

      await service.reconcilePendingCardPayments();

      expect(paymentRepository.find).not.toHaveBeenCalled();
      expect(paymentProvider.getInvoiceStatus).not.toHaveBeenCalled();
    });

    describe('reconcileOrdersWithoutInvoice', () => {
      const NOW = new Date('2026-10-13T12:00:00Z');
      const OLD_ORDER_DATE = new Date('2026-10-13T10:00:00Z');
      const _YOUNG_ORDER_DATE = new Date('2026-10-13T11:30:00Z');

      beforeEach(() => {
        process.env.MONO_ACQUIRING_TOKEN = 'test-token';
        jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());

        orderRepository.find = jest.fn().mockResolvedValue([]);
        orderRepository.findOne.mockResolvedValue(null);
        paymentRepository.find = jest.fn().mockResolvedValue([]);
        manager.findOne.mockResolvedValue(null);
        orderService.cancelOrderWithoutInvoice = jest.fn().mockImplementation(async (mgr: any, id: number) => {
          const o = await mgr.findOne(OrderEntity, { where: { id } });
          if (o) {
            o.status = Status.Canceled;
            o.paymentStatus = PaymentStatus.Failed;
            return o;
          }
          return null;
        });
      });

      afterEach(() => {
        delete process.env.MONO_ACQUIRING_TOKEN;
        jest.restoreAllMocks();
      });

      it('cancels CARD order without invoice older than timeout, marks FAILED, returns stock', async () => {
        const oldOrder = {
          id: 20,
          total: 1000,
          status: Status.Processed,
          paymentMethod: PaymentMethod.Card,
          paymentStatus: PaymentStatus.NotRequired,
          paymentInvoiceId: null,
          createdAt: OLD_ORDER_DATE,
          items: [{ productId: 1, quantity: 2 }],
        };
        orderRepository.find.mockResolvedValueOnce([oldOrder]);
        manager.findOne.mockImplementation((entity: any) =>
          Promise.resolve(entity === OrderEntity ? { ...oldOrder } : null),
        );
        manager.transaction = jest.fn().mockImplementation(async (cb) => cb(manager));

        await service.reconcilePendingCardPayments();

        const findCall = orderRepository.find.mock.calls[0][0];
        expect(findCall.where).toEqual(
          expect.objectContaining({
            paymentMethod: PaymentMethod.Card,
            paymentInvoiceId: expect.any(Object), // IsNull()
            paymentStatus: PaymentStatus.NotRequired,
            status: Status.Processed,
            createdAt: expect.any(Object), // LessThanOrEqual
          }),
        );
        // createdAt має бути меншим або рівним NOW - (timeout + 5 хв)
        const expectedCutoff = new Date(
          NOW.getTime() - (DEFAULT_PAYMENT_TIMEOUT_MINUTES + STATUS_CHECK_GRACE_MINUTES) * 60_000,
        );
        expect(findCall.where.createdAt.value).toEqual(expectedCutoff);
        expect(orderService.cancelOrderWithoutInvoice).toHaveBeenCalledWith(manager, 20);
        const statusLogs = manager.save.mock.calls.filter(
          ([entity, data]: [unknown, any]) =>
            entity === PaymentEntity && data.kind === PaymentLogKind.StatusCheck,
        );
        expect(statusLogs).toHaveLength(1);
        expect(statusLogs[0][1]).toEqual(
          expect.objectContaining({
            orderId: 20,
            status: PaymentStatus.Failed,
            kind: PaymentLogKind.StatusCheck,
            invoiceId: '',
            rawPayload: expect.objectContaining({ reason: 'invoice_creation_failed' }),
          }),
        );
      });

      it('does not cancel CARD order without invoice younger than timeout', async () => {
        orderRepository.find.mockResolvedValueOnce([]);

        await service.reconcilePendingCardPayments();

        const findCall = orderRepository.find.mock.calls[0][0];
        expect(findCall.where).toEqual(
          expect.objectContaining({
            paymentMethod: PaymentMethod.Card,
            paymentInvoiceId: expect.any(Object),
            paymentStatus: PaymentStatus.NotRequired,
            status: Status.Processed,
            createdAt: expect.any(Object),
          }),
        );
        const expectedCutoff = new Date(
          NOW.getTime() - (DEFAULT_PAYMENT_TIMEOUT_MINUTES + STATUS_CHECK_GRACE_MINUTES) * 60_000,
        );
        expect(findCall.where.createdAt.value).toEqual(expectedCutoff);
        expect(orderService.cancelOrderWithoutInvoice).not.toHaveBeenCalled();
        expect(manager.save).not.toHaveBeenCalledWith(
          PaymentEntity,
          expect.objectContaining({ kind: PaymentLogKind.StatusCheck }),
        );
      });

      it('does not touch COD orders', async () => {
        orderRepository.find.mockResolvedValueOnce([]);

        await service.reconcilePendingCardPayments();

        const findCall = orderRepository.find.mock.calls[0][0];
        expect(findCall.where.paymentMethod).toBe(PaymentMethod.Card);
        expect(orderService.cancelOrderWithoutInvoice).not.toHaveBeenCalled();
      });

      it('works without MONO_ACQUIRING_TOKEN for orders without invoice', async () => {
        delete process.env.MONO_ACQUIRING_TOKEN;

        const oldOrder = {
          id: 23,
          total: 1000,
          status: Status.Processed,
          paymentMethod: PaymentMethod.Card,
          paymentStatus: PaymentStatus.NotRequired,
          paymentInvoiceId: null,
          createdAt: OLD_ORDER_DATE,
          items: [{ productId: 1, quantity: 1 }],
        };
        orderRepository.find.mockResolvedValueOnce([oldOrder]);
        manager.findOne.mockImplementation((entity: any) =>
          Promise.resolve(entity === OrderEntity ? { ...oldOrder } : null),
        );
        manager.transaction = jest.fn().mockImplementation(async (cb) => cb(manager));

        await service.reconcilePendingCardPayments();

        expect(orderService.cancelOrderWithoutInvoice).toHaveBeenCalledWith(manager, 23);
        expect(paymentProvider.getInvoiceStatus).not.toHaveBeenCalled();
      });
    });
  });
});
