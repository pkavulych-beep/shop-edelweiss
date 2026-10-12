export interface CreateInvoiceInput {
  amount: number;
  ccy: number;
  orderId: string;
  webHookUrl: string;
  redirectUrl: string;
  reference: string;
}

export interface CreateInvoiceOutput {
  invoiceId: string;
  pageUrl: string;
}

export interface VerifyWebhookInput {
  body: Record<string, unknown>;
  signature: string;
}

export interface VerifyWebhookOutput {
  orderId: string;
  invoiceId: string;
  status: string;
  amount: number;
}

export interface RefundInput {
  invoiceId: string;
  amount?: number;
}

export interface PaymentProvider {
  createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceOutput>;
  verifyWebhook(input: VerifyWebhookInput): VerifyWebhookOutput;
  refund(input: RefundInput): Promise<void>;
}