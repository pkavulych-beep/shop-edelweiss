import axios from 'axios';
import nookies, { parseCookies } from 'nookies';
import { NextPageContext, GetServerSidePropsContext } from 'next';
import { userApi } from './UserApi';
import { productApi } from './ProductApi';
import { authApi } from './authApi';
import { cartApi } from './CartApi';
import { ordersApi } from './OrderApi';
import { quickOrderApi } from './QuickOrderApi';

export type ApiReturnType = {
  user: ReturnType<typeof userApi>;
  product: ReturnType<typeof productApi>;
  auth: ReturnType<typeof authApi>;
  cart: ReturnType<typeof cartApi>;
  orders: ReturnType<typeof ordersApi>;
  quickOrder: ReturnType<typeof quickOrderApi>;
};

export const Api = (
  ctx?: NextPageContext | GetServerSidePropsContext
): ApiReturnType => {
  const cookies = ctx ? nookies.get(ctx) : parseCookies();
  const token = cookies.token;

  const instance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7777',
    headers: {
      Authorization: 'Bearer ' + token
    }
  });

  return {
    user: userApi(instance),
    product: productApi(instance),
    auth: authApi(instance),
    cart: cartApi(instance),
    orders: ordersApi(instance),
    quickOrder: quickOrderApi(instance)
  };
};
