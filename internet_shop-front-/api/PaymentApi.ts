import { AxiosInstance } from 'axios';

export interface CreateInvoiceResponse {
  pageUrl: string;
}

export interface PaymentMethodsResponse {
  card: boolean;
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
});