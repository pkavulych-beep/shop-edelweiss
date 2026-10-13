import { Injectable, InternalServerErrorException } from '@nestjs/common';
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
        orderId: input.orderId,
        webHookUrl: input.webHookUrl,
        redirectUrl: input.redirectUrl,
        merchantPaymInfo: {
          reference: input.reference,
        },
      },
    );
    return { invoiceId, pageUrl };
  }

  verifyWebhook(input: VerifyWebhookInput): VerifyWebhookOutput {
    const { body } = input;
    const invoiceId = body.invoiceId as string;
    const status = body.status as string;
    const orderId = body.orderId as string;
    const amount = body.amount as number;

    if (!invoiceId || !status || !orderId || !amount) {
      throw new InternalServerErrorException('Invalid webhook payload');
    }

    return { invoiceId, orderId, status, amount };
  }

  async refund(input: RefundInput): Promise<void> {
    await this.request('POST', `/cancel`, {
      invoiceId: input.invoiceId,
      ...(input.amount !== undefined && { amount: input.amount }),
    });
  }
}