import { AxiosInstance } from 'axios';
import { IProduct } from '../redux/Types/ProductType';

export type CreateQuickOrderDto = {
  phoneNumber: string;
  productId: number;
  size?: string;
};

export type QuickOrder = {
  id: number;
  phoneNumber: string;
  // null, якщо товар уже видалили
  product: IProduct | null;
  size: string | null;
  createdAt: string;
};

export const quickOrderApi = (instance: AxiosInstance) => ({
  async create(dto: CreateQuickOrderDto) {
    const { data } = await instance.post<{ id: number; createdAt: string }>('quick-order', dto);
    return data;
  },

  async findAll() {
    const { data } = await instance.get<QuickOrder[]>('quick-order');
    return data;
  },

  async remove(id: number) {
    const { data } = await instance.delete<string>(`quick-order/${id}`);
    return data;
  },
});
