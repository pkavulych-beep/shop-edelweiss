import { PaymentStatus } from '../../order/paymentEnum';

export interface CreateInvoiceInput {
  amount: number;
  ccy: number;
  webHookUrl: string;
  redirectUrl: string;
  reference: string;
  // Скільки секунд рахунок можна оплатити. Після цього mono його закриває.
  validity: number;
}

export interface CreateInvoiceOutput {
  invoiceId: string;
  pageUrl: string;
}

// Відповідь mono на GET /invoice/status. status — сирий статус провайдера
// (created, processing, hold, success, failure, expired, reversed).
export interface InvoiceStatusResult {
  invoiceId: string;
  status: string;
  amount: number;
  ccy: number;
  modifiedDate?: string;
  [key: string]: unknown;
}

// Підпис рахується над сирими байтами тіла, тож сюди передається саме
// req.rawBody, а не розпарсений і заново зсеріалізований JSON.
export interface VerifyWebhookInput {
  rawBody: Buffer | undefined;
  signature: string | undefined;
}

// Перевірений вебхук, уже переведений у наші статуси оплати.
export interface WebhookEvent {
  invoiceId: string;
  status: PaymentStatus;
  amount: number;
  ccy: number;
  modifiedDate: Date;
  payload: Record<string, unknown>;
}

export interface RefundInput {
  invoiceId: string;
  amount?: number;
}

export interface PaymentProvider {
  createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceOutput>;
  // Кидає BadRequestException, якщо підпису немає, він не збігається або тіло
  // не схоже на вебхук провайдера.
  verifyWebhook(input: VerifyWebhookInput): Promise<WebhookEvent>;
  refund(input: RefundInput): Promise<void>;
  // Статус інвойсу — лише для звірки, коли вебхук міг загубитися.
  getInvoiceStatus(invoiceId: string): Promise<InvoiceStatusResult>;
  // Робить рахунок неоплачуваним (скасовує його в mono).
  invalidateInvoice(invoiceId: string): Promise<void>;
}
