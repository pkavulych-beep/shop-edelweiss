import { IUserData } from '../redux/Types/ProductType';
import { AxiosInstance } from 'axios';

// Структура BasketItemEntity з бекенду (eager load product)
export interface IBasketItemResponse {
  id: number;
  userId: number;
  productId: number;
  size: string;
  quantity: number;
  product: {
    id: number;
    name: string;
    cover: string;
    sizes: string[];
    price: number;
    salePrice: number;
  };
}

export interface IUserDataAndCart extends IUserData {
  cartItems: IBasketItemResponse[];
}

export const authApi = (instance: AxiosInstance) => ({
  async login(loginDto: { phoneNumber: string; password: string }) {
    const data = await instance.post('/auth/login', loginDto);
    return data;
  },

  async register(registerDto) {
    const data = await instance.post('/auth/register', registerDto);
    return data;
  },

  async logout(refreshToken: string) {
    // Робить refresh-токен недійсним на беку
    await instance.post('/auth/logout', { refreshToken });
  },

  async authorization() {
    const { data } = await instance.get<IUserDataAndCart>('/auth/profile');
    return data;
  },
});
