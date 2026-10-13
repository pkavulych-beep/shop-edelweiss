import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentStatus } from '../order/paymentEnum';
import { CreateInvoiceInput } from './providers/payment-provider.interface';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepository: any;
  let orderRepository: any;
  let orderService: any;
  let paymentProvider: any;

  const mockOrder = {
    id: 10,
    user: { id: 3 },
    total: 1500,
    paymentMethod: 'CARD',
    paymentStatus: PaymentStatus.NotRequired,
    paymentInvoiceId: null,
    paidAt: null,
  };

  const mockUser = { id: 3, roles: [{ value: 'USER' }] };

  beforeEach(() => {
    paymentRepository = {
      create: jest.fn().mockReturnValue({ id: 1 }),
      save: jest.fn().mockResolvedValue({ id: 1 }),
      findOne: jest.fn().mockResolvedValue(null),
    };
    orderRepository = {
      findOne: jest.fn().mockResolvedValue({ ...mockOrder }),
      save: jest.fn().mockResolvedValue({ ...mockOrder }),
    };
    orderService = {
      findOneForUser: jest.fn().mockResolvedValue({ ...mockOrder }),
    };
    process.env.BASE_URL = 'http://localhost:7777/';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    paymentProvider = {
      createInvoice: jest.fn().mockResolvedValue({
        invoiceId: 'mono-invoice-123',
        pageUrl: 'https://mono.com/invoice/mono-invoice-123',
      }),
      refund: jest.fn().mockResolvedValue(undefined),
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

      expect(paymentProvider.refund).toHaveBeenCalledWith({
        invoiceId: 'mono-invoice-123',
        amount: undefined,
      });
      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.Refunded }),
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

    it('rejects a refund larger than the payment amount', async () => {
      paymentRepository.findOne.mockResolvedValueOnce(paidLog());

      await expect(service.refund('mono-invoice-123', 200000)).rejects.toBeInstanceOf(
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
  });
});