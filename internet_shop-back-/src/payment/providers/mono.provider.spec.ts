import { generateKeyPairSync, sign } from 'crypto';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { MonoPaymentProvider } from './mono.provider';
import { PaymentStatus } from '../../order/paymentEnum';

describe('MonoPaymentProvider', () => {
  let provider: MonoPaymentProvider;

  beforeEach(() => {
    process.env.MONO_ACQUIRING_TOKEN = 'test-token';
    provider = new MonoPaymentProvider();
  });

  describe('createInvoice', () => {
    it('throws when token is not configured', async () => {
      delete process.env.MONO_ACQUIRING_TOKEN;
      global.fetch = jest.fn();

      await expect(
        provider.createInvoice({
          amount: 150000,
          ccy: 980,
          webHookUrl: 'http://localhost:7777/payment/webhook/mono',
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
        webHookUrl: 'http://localhost:7777/payment/webhook/mono',
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
            webHookUrl: 'http://localhost:7777/payment/webhook/mono',
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
          webHookUrl: 'http://localhost:7777/payment/webhook/mono',
          redirectUrl: 'http://localhost:3000/order/10',
          reference: '10',
        }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('verifyWebhook', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const pubkeyBase64 = Buffer.from(
      publicKey.export({ type: 'spki', format: 'pem' }) as string,
    ).toString('base64');

    // Ключі в тілі навмисно не в алфавітному порядку і з пробілами: підпис
    // має сходитися саме з сирими байтами, а не з повторно зсеріалізованим JSON.
    const rawBody = Buffer.from(
      '{"invoiceId": "p2_9ZgpZVsl3", "status": "success", "amount": 150000, ' +
        '"ccy": 980, "reference": "10", "modifiedDate": "2026-10-13T10:00:00Z"}',
    );
    const signBody = (body: Buffer) => sign('sha256', body, privateKey).toString('base64');

    const mockPubkeyFetch = () =>
      (global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ key: pubkeyBase64 }),
      }));

    afterEach(() => {
      delete process.env.MONO_PUBLIC_KEY;
    });

    it('accepts a valid signature and maps the mono status', async () => {
      mockPubkeyFetch();

      const event = await provider.verifyWebhook({ rawBody, signature: signBody(rawBody) });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.monobank.ua/api/merchant/pubkey',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ 'X-Token': 'test-token' }),
        }),
      );
      expect(event).toEqual({
        invoiceId: 'p2_9ZgpZVsl3',
        status: PaymentStatus.Paid,
        amount: 150000,
        ccy: 980,
        modifiedDate: new Date('2026-10-13T10:00:00Z'),
        payload: JSON.parse(rawBody.toString()),
      });
    });

    it('caches the public key between webhooks', async () => {
      mockPubkeyFetch();

      await provider.verifyWebhook({ rawBody, signature: signBody(rawBody) });
      await provider.verifyWebhook({ rawBody, signature: signBody(rawBody) });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('uses MONO_PUBLIC_KEY without asking mono', async () => {
      process.env.MONO_PUBLIC_KEY = pubkeyBase64;
      global.fetch = jest.fn();

      await provider.verifyWebhook({ rawBody, signature: signBody(rawBody) });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects a missing X-Sign header with 400', async () => {
      mockPubkeyFetch();

      await expect(
        provider.verifyWebhook({ rawBody, signature: undefined }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects a signature that does not match the body with 400', async () => {
      mockPubkeyFetch();
      const tampered = Buffer.from(rawBody.toString().replace('150000', '1'));

      await expect(
        provider.verifyWebhook({ rawBody: tampered, signature: signBody(rawBody) }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a signature over the re-serialized JSON instead of the raw body', async () => {
      mockPubkeyFetch();
      const reserialized = Buffer.from(JSON.stringify(JSON.parse(rawBody.toString())));

      await expect(
        provider.verifyWebhook({ rawBody, signature: signBody(reserialized) }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects garbage in X-Sign with 400', async () => {
      mockPubkeyFetch();

      await expect(
        provider.verifyWebhook({ rawBody, signature: 'not-a-signature' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('re-fetches a rotated key, but not more often than once a minute', async () => {
      const old = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey;
      const oldBase64 = Buffer.from(
        old.export({ type: 'spki', format: 'pem' }) as string,
      ).toString('base64');
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ key: oldBase64 }) })
        .mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({ key: pubkeyBase64 }) });
      const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

      // Щойно отриманий ключ не перезапитується: підпис просто не зійшовся.
      await expect(
        provider.verifyWebhook({ rawBody, signature: signBody(rawBody) }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      now.mockReturnValue(1_000_000 + 61_000);
      await expect(
        provider.verifyWebhook({ rawBody, signature: signBody(rawBody) }),
      ).resolves.toEqual(expect.objectContaining({ invoiceId: 'p2_9ZgpZVsl3' }));
      expect(global.fetch).toHaveBeenCalledTimes(2);
      now.mockRestore();
    });

    it('rejects a signed body without modifiedDate', async () => {
      mockPubkeyFetch();
      const body = Buffer.from('{"invoiceId":"p2_9ZgpZVsl3","status":"success","amount":1}');

      await expect(
        provider.verifyWebhook({ rawBody: body, signature: signBody(body) }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each([
      ['created', PaymentStatus.Pending],
      ['processing', PaymentStatus.Pending],
      ['hold', PaymentStatus.Pending],
      ['failure', PaymentStatus.Failed],
      ['expired', PaymentStatus.Failed],
      ['reversed', PaymentStatus.Refunded],
      ['something-new', PaymentStatus.Pending],
    ])('maps mono status %s to %s', async (monoStatus, expected) => {
      mockPubkeyFetch();
      const body = Buffer.from(rawBody.toString().replace('"success"', `"${monoStatus}"`));

      const event = await provider.verifyWebhook({ rawBody: body, signature: signBody(body) });

      expect(event.status).toBe(expected);
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
