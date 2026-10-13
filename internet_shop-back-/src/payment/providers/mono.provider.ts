import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { verify } from 'crypto';
import { PaymentStatus } from '../../order/paymentEnum';
import {
  CreateInvoiceInput,
  CreateInvoiceOutput,
  PaymentProvider,
  RefundInput,
  VerifyWebhookInput,
  WebhookEvent,
} from './payment-provider.interface';

const MONO_API_BASE = 'https://api.monobank.ua/api/merchant';

// Ключ, яким mono підписує вебхуки, може змінитися. Якщо підпис не зійшовся,
// ключ перезапитується, але не частіше, ніж раз на хвилину: інакше кожен
// підроблений запит смикав би API mono.
const PUBKEY_REFRESH_INTERVAL_MS = 60_000;

// Статуси інвойсу mono → наш статус оплати.
const MONO_STATUSES: Record<string, PaymentStatus> = {
  created: PaymentStatus.Pending,
  processing: PaymentStatus.Pending,
  hold: PaymentStatus.Pending,
  success: PaymentStatus.Paid,
  failure: PaymentStatus.Failed,
  expired: PaymentStatus.Failed,
  reversed: PaymentStatus.Refunded,
};

@Injectable()
export class MonoPaymentProvider implements PaymentProvider {
  private publicKey: string | null = null;
  private publicKeyFetchedAt = 0;

  private get token(): string {
    const token = process.env.MONO_ACQUIRING_TOKEN;
    if (!token) {
      throw new InternalServerErrorException('MONO_ACQUIRING_TOKEN is not configured');
    }
    return token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${MONO_API_BASE}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Token': this.token,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new InternalServerErrorException(
        `Mono API error: ${response.status} ${errorText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  async createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceOutput> {
    const { invoiceId, pageUrl } = await this.request<{ invoiceId: string; pageUrl: string }>(
      'POST',
      '/invoice/create',
      {
        amount: input.amount,
        ccy: input.ccy,
        webHookUrl: input.webHookUrl,
        redirectUrl: input.redirectUrl,
        merchantPaymInfo: {
          reference: input.reference,
        },
      },
    );
    return { invoiceId, pageUrl };
  }

  async verifyWebhook({ rawBody, signature }: VerifyWebhookInput): Promise<WebhookEvent> {
    if (!signature) {
      throw new BadRequestException('Немає підпису X-Sign');
    }
    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Порожнє тіло вебхука');
    }

    let valid = this.checkSignature(rawBody, signature, await this.getPublicKey());
    if (!valid && this.canRefreshPublicKey()) {
      valid = this.checkSignature(rawBody, signature, await this.getPublicKey(true));
    }
    if (!valid) {
      throw new BadRequestException('Підпис X-Sign не збігається');
    }

    return this.parseWebhook(rawBody);
  }

  async refund(input: RefundInput): Promise<void> {
    await this.request('POST', '/invoice/cancel', {
      invoiceId: input.invoiceId,
      ...(input.amount !== undefined && { amount: input.amount }),
    });
  }

  // ECDSA + SHA-256 над сирим тілом; X-Sign — підпис у base64.
  private checkSignature(rawBody: Buffer, signature: string, publicKeyPem: string): boolean {
    try {
      return verify('sha256', rawBody, publicKeyPem, Buffer.from(signature, 'base64'));
    } catch {
      return false;
    }
  }

  // Ключ кешується в пам'яті. MONO_PUBLIC_KEY (у тому ж base64, що й відповідь
  // /pubkey) дозволяє закріпити ключ без запиту до mono.
  private async getPublicKey(refresh = false): Promise<string> {
    if (this.publicKey && !refresh) {
      return this.publicKey;
    }

    const configured = process.env.MONO_PUBLIC_KEY;
    const base64Key = configured
      ? configured
      : (await this.request<{ key: string }>('GET', '/pubkey')).key;

    this.publicKey = Buffer.from(base64Key, 'base64').toString('utf8');
    this.publicKeyFetchedAt = Date.now();
    return this.publicKey;
  }

  private canRefreshPublicKey(): boolean {
    return (
      !process.env.MONO_PUBLIC_KEY &&
      Date.now() - this.publicKeyFetchedAt >= PUBKEY_REFRESH_INTERVAL_MS
    );
  }

  private parseWebhook(rawBody: Buffer): WebhookEvent {
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Тіло вебхука не є JSON');
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('Тіло вебхука не є об’єктом');
    }

    const body = payload as Record<string, unknown>;
    const { invoiceId, status, amount, ccy, modifiedDate } = body;
    const modified = typeof modifiedDate === 'string' ? new Date(modifiedDate) : null;

    if (
      typeof invoiceId !== 'string' ||
      !invoiceId ||
      typeof status !== 'string' ||
      typeof amount !== 'number' ||
      !modified ||
      Number.isNaN(modified.getTime())
    ) {
      throw new BadRequestException('Вебхук mono без invoiceId, status, amount чи modifiedDate');
    }

    return {
      invoiceId,
      // Невідомий статус не змінює оплату, але потрапляє в журнал.
      status: MONO_STATUSES[status] ?? PaymentStatus.Pending,
      amount,
      ccy: typeof ccy === 'number' ? ccy : 980,
      modifiedDate: modified,
      payload: body,
    };
  }
}
