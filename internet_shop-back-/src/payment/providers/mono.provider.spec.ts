import { MonoPaymentProvider } from './mono.provider';
import { InternalServerErrorException } from '@nestjs/common';

describe('MonoPaymentProvider', () => {
  let provider: MonoPaymentProvider;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'MONO_ACQUIRING_TOKEN') return 'test-token';
        return undefined;
      }),
    };
    provider = new MonoPaymentProvider(configService as any);
  });

  describe('createInvoice', () => {
    it('throws when token is not configured', async () => {
      configService.get.mockReturnValueOnce(undefined);
      global.fetch = jest.fn();

      await expect(
        provider.createInvoice({
          amount: 150000,
          ccy: 980,
          orderId: '10',
          webHookUrl: 'http://localhost:7777/payment/webhook',
          redirectUrl: 'http://localhost:3000/order/10',
          reference: '10',
        }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('makes request to Mono API with correct parameters', async () => {
      const mockResponse = {
        invoiceId: 'mono-invoice-123',
        pageUrl: 'https://mono.com/invoice/mono-invoice-123',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await provider.createInvoice({
        amount: 150000,
        ccy: 980,
        orderId: '10',
        webHookUrl: 'http://localhost:7777/payment/webhook',
        redirectUrl: 'http://localhost:3000/order/10',
        reference: '10',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.monobank.ua/api/merchant/invoice/create',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Token': 'test-token',
          }),
          body: JSON.stringify({
            amount: 150000,
            ccy: 980,
            orderId: '10',
            webHookUrl: 'http://localhost:7777/payment/webhook',
            redirectUrl: 'http://localhost:3000/order/10',
            merchantPaymInfo: { reference: '10' },
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('throws on API error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('Bad Request'),
      });

      await expect(
        provider.createInvoice({
          amount: 150000,
          ccy: 980,
          orderId: '10',
          webHookUrl: 'http://localhost:7777/payment/webhook',
          redirectUrl: 'http://localhost:3000/order/10',
          reference: '10',
        }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('verifyWebhook', () => {
    it('returns parsed webhook data', () => {
      const result = provider.verifyWebhook({
        body: {
          invoiceId: 'mono-invoice-123',
          orderId: '10',
          status: 'success',
          amount: 150000,
        },
        signature: 'test-signature',
      });

      expect(result).toEqual({
        invoiceId: 'mono-invoice-123',
        orderId: '10',
        status: 'success',
        amount: 150000,
      });
    });

    it('throws on invalid payload', () => {
      expect(() =>
        provider.verifyWebhook({
          body: { invoiceId: 'mono-invoice-123' },
          signature: 'test-signature',
        }),
      ).toThrow(InternalServerErrorException);
    });
  });

  describe('refund', () => {
    it('makes request to Mono API to cancel invoice', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      await provider.refund({ invoiceId: 'mono-invoice-123', amount: 50000 });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.monobank.ua/api/merchant/invoice/cancel',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Token': 'test-token',
          }),
          body: JSON.stringify({ invoiceId: 'mono-invoice-123', amount: 50000 }),
        }),
      );
    });

    it('makes request without amount for full refund', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      await provider.refund({ invoiceId: 'mono-invoice-123' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.monobank.ua/api/merchant/invoice/cancel',
        expect.objectContaining({
          body: JSON.stringify({ invoiceId: 'mono-invoice-123' }),
        }),
      );
    });
  });
});