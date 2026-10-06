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

// "+38 (099) 123-45-67", "099 123 45 67" → "380991234567"; null, якщо номер некоректний
export const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  const phone = digits.length === 10 && digits.startsWith('0') ? `38${digits}` : digits;
  return /^380\d{9}$/.test(phone) ? phone : null;
};

// "380991234567" → "+38 (099) 123-45-67"
export const formatPhone = (phone: string) =>
  phone.replace(/^38(\d{3})(\d{3})(\d{2})(\d{2})$/, '+38 ($1) $2-$3-$4');
