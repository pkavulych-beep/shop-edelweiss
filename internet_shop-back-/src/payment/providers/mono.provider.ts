import {
  Injectable,
  InternalServerErrorException,
  NotImplementedException,
} from '@nestjs/common';
import {
  CreateInvoiceInput,
  CreateInvoiceOutput,
  PaymentProvider,
  RefundInput,
  VerifyWebhookInput,
  VerifyWebhookOutput,
} from './payment-provider.interface';

const MONO_API_BASE = 'https://api.monobank.ua/api/merchant/invoice';

@Injectable()
export class MonoPaymentProvider implements PaymentProvider {
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
      '/create',
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

  // Перевірка підпису X-Sign (ECDSA + SHA-256 над сирим тілом), звірка суми та
  // ідемпотентність вебхука реалізуються в #192. До того часу endpoint вебхука
  // не під'єднано, тож цей метод навмисно не приймає нічого довіреного.
  verifyWebhook(_input: VerifyWebhookInput): VerifyWebhookOutput {
    throw new NotImplementedException('Перевірку вебхука реалізовано в #192');
  }

  async refund(input: RefundInput): Promise<void> {
    await this.request('POST', `/cancel`, {
      invoiceId: input.invoiceId,
      ...(input.amount !== undefined && { amount: input.amount }),
    });
  }
}