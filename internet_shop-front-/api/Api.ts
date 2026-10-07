import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import nookies, { destroyCookie, parseCookies, setCookie } from 'nookies';
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

type Ctx = NextPageContext | GetServerSidePropsContext;

export type AuthTokens = { token: string; refreshToken: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7777';

// ctx буває і в браузері (getInitialProps під час переходу між сторінками),
// тож сервер від браузера відрізняємо так
const isServer = typeof window === 'undefined';

// Access-токен живе 15 хвилин, але cookie тримаємо стільки ж, скільки refresh-токен:
// за наявністю cookie видно, що користувач увійшов, а прострочений токен оновить interceptor
const COOKIE_OPTIONS = { maxAge: 30 * 24 * 60 * 60, path: '/' };

// На сервері nookies.get(ctx) читає cookie із запиту, тож нові токени після
// оновлення під час SSR він не побачить. Тримаємо їх тут до кінця запиту.
const ssrTokens = new WeakMap<Ctx, Partial<AuthTokens>>();

const readTokens = (ctx?: Ctx): Partial<AuthTokens> => {
  if (isServer && ctx && ssrTokens.has(ctx)) return ssrTokens.get(ctx);
  const cookies = ctx ? nookies.get(ctx) : parseCookies();
  return { token: cookies.token, refreshToken: cookies.refreshToken };
};

export const getRefreshToken = (ctx?: Ctx) => readTokens(ctx).refreshToken;

export const saveTokens = ({ token, refreshToken }: AuthTokens, ctx?: Ctx) => {
  if (isServer && ctx) ssrTokens.set(ctx, { token, refreshToken });
  setCookie(ctx ?? null, 'token', token, COOKIE_OPTIONS);
  setCookie(ctx ?? null, 'refreshToken', refreshToken, COOKIE_OPTIONS);
};

export const clearTokens = (ctx?: Ctx) => {
  if (isServer && ctx) ssrTokens.set(ctx, {});
  destroyCookie(ctx ?? null, 'token', { path: '/' });
  destroyCookie(ctx ?? null, 'refreshToken', { path: '/' });
};

// Логін, реєстрація, оновлення і вихід самі відповідають 401 на невірні дані,
// оновлювати для них токен не треба
const isAuthRequest = (url = '') =>
  /(^|\/)auth\/(login|register|refresh|logout)$/.test(url);

// Кілька запитів можуть одночасно отримати 401. Оновлюємо токен один раз,
// бо після ротації старий refresh-токен уже недійсний.
const refreshing = new Map<Ctx | 'browser', Promise<string | null>>();

// Повертає новий access-токен або null, якщо сесія завершилася
const requestNewToken = async (ctx?: Ctx): Promise<string | null> => {
  const { refreshToken } = readTokens(ctx);
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post<AuthTokens>(`${API_URL}/auth/refresh`, {
      refreshToken
    });
    saveTokens(data, ctx);
    return data.token;
  } catch (e) {
    if (!axios.isAxiosError(e) || e.response?.status !== 401) throw e;
    // Інша вкладка могла оновити токени раніше: тоді в cookie вже новий refresh-токен
    const current = readTokens(ctx);
    if (!isServer && current.refreshToken && current.refreshToken !== refreshToken) {
      return current.token;
    }
    return null;
  }
};

const refreshAccessToken = (ctx?: Ctx): Promise<string | null> => {
  const key = isServer && ctx ? ctx : 'browser';
  if (!refreshing.has(key)) {
    refreshing.set(
      key,
      requestNewToken(ctx).finally(() => refreshing.delete(key))
    );
  }
  return refreshing.get(key);
};

const endSession = (ctx?: Ctx) => {
  clearTokens(ctx);
  // У браузері ведемо на вхід: Header відкриє форму входу за ?login=1
  if (!isServer) {
    window.location.assign('/?login=1');
  }
};

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

export const Api = (ctx?: Ctx): ApiReturnType => {
  const instance = axios.create({ baseURL: API_URL });

  // Токен читаємо перед кожним запитом: після оновлення в cookie вже новий
  instance.interceptors.request.use((config) => {
    const { token } = readTokens(ctx);
    if (token) {
      config.headers.Authorization = 'Bearer ' + token;
    }
    return config;
  });

  instance.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    if (
      error.response?.status !== 401 ||
      !config ||
      config._retried ||
      isAuthRequest(config.url) ||
      !config.headers.Authorization
    ) {
      throw error;
    }
    config._retried = true;

    let token: string | null;
    try {
      token = await refreshAccessToken(ctx);
    } catch {
      // Бек недоступний: сесію не скидаємо, віддаємо початкову помилку
      throw error;
    }
    if (!token) {
      endSession(ctx);
      throw error;
    }
    return instance(config);
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
