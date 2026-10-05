import { AxiosInstance } from 'axios';
import { CartItem } from '../redux/Types/ProductType';

// Власника кошика бек бере з JWT-токена
export type addToCartDto = {
  idProduct: number;
  size: string;
};

export type removeFromCartDto = {
  idProduct: number;
  size: string;
};

export type syncCartDto = {
  items: { productId: number; size: string; quantity: number }[];
};

export const cartApi = (instance: AxiosInstance) => ({
  async addProductToCart(dto: addToCartDto) {
    const { data } = await instance.patch('users/addProduct', dto);
    return data;
  },
  async pickUpFromTheBasket(dto: removeFromCartDto) {
    const { data } = await instance.patch('users/pickUpFromTheBasket', dto);
    return data;
  },
  async syncCart(dto: syncCartDto) {
    const { data } = await instance.post('users/syncCart', dto);
    return data;
  },
});
