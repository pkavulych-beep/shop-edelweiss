import { AxiosInstance } from 'axios';

export interface CreateInvoiceResponse {
  pageUrl: string;
}

export const paymentApi = (instance: AxiosInstance) => ({
  async createInvoice(orderId: number): Promise<CreateInvoiceResponse> {
    const { data } = await instance.post<CreateInvoiceResponse>(`payment/${orderId}/invoice`);
    return data;
  },
});