import { AxiosInstance } from 'axios';

export interface CreateInvoiceResponse {
  pageUrl: string;
}

export interface PaymentMethodsResponse {
  card: boolean;
}

// Подія з журналу payment: invoice — рахунок створено, webhook — сповіщення
// від mono, status — звірка статусу.
export type PaymentHistoryKind = 'invoice' | 'webhook' | 'status';

export interface PaymentHistoryEntry {
  // Час запису в журнал (ISO)
  at: string;
  kind: PaymentHistoryKind;
  status: string;
  // Сума в копійках, як і в базі
  amount: number;
  // Статус mono з payload, якщо він там був
  monoStatus?: string;
  failureReason?: string;
}

export interface OrderPaymentDetails {
  invoiceId: string | null;
  paidAt: string | null;
  // Суми в копійках, як і в базі
  amount: number | null;
  refundedAmount: number;
  refundableAmount: number;
  history: PaymentHistoryEntry[];
}

export const paymentApi = (instance: AxiosInstance) => ({
  async getMethods(): Promise<PaymentMethodsResponse> {
    const { data } = await instance.get<PaymentMethodsResponse>('payment/methods');
    return data;
  },

  async createInvoice(orderId: number): Promise<CreateInvoiceResponse> {
    const { data } = await instance.post<CreateInvoiceResponse>(`payment/${orderId}/invoice`);
    return data;
  },

  async getOrderPayment(orderId: number): Promise<OrderPaymentDetails> {
    const { data } = await instance.get<OrderPaymentDetails>(`payment/order/${orderId}`);
    return data;
  },

  async refund(invoiceId: string, amount?: number): Promise<void> {
    await instance.post(
      `payment/${encodeURIComponent(invoiceId)}/refund`,
      amount === undefined ? {} : { amount }
    );
  },
});
