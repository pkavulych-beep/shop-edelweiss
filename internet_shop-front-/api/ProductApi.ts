import { IProduct, IProductFilters, IProductsResponse, CartProductDetails, photo } from '../redux/Types/ProductType';
import { AxiosInstance } from 'axios';

export const productApi = (instance: AxiosInstance) => ({
  async create(dto) {
    const { data } = await instance.post<IProduct>('/product', dto);
    return data;
  },
  // Новий метод з фільтрами через query params
  async findFiltered(filters: IProductFilters = {}): Promise<IProductsResponse> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val != null && val !== '') params.append(key, String(val));
    });
    const { data } = await instance.get<IProductsResponse>(`/product/filter?${params.toString()}`);
    return data;
  },
  async findById(id) {
    const { data } = await instance.get<IProduct>(`/product/${id}`);
    return data;
  },
  async update(id, dto) {
    dto.salePrice = dto.salePrice ? dto.salePrice : null;
    const { data } = await instance.patch<IProduct>(`/product/${id}`, dto);
    return data;
  },
  async deleteById(id) {
    const { data } = await instance.delete(`/product/${id}`);
    return data;
  },
  async getPhotosProduct(id) {
    const { data } = await instance.get<photo[]>(`/product/photos/${id}`);
    return data;
  },
  async getDiscountList(gender) {
    const { data } = await instance.get<IProduct[]>(`/product/discounts/${gender}`);
    return data;
  },
  async findByIds(ids: number[]) {
    const { data } = await instance.post<CartProductDetails[]>('/product/byIds', { ids });
    return data;
  },
});
