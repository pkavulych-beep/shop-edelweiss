import "../styles/globals.css";
import * as React from "react";
import { useEffect } from "react";
import { Provider } from "react-redux";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { wrapper } from "../redux/redux-store";
import type { AppProps } from "next/app";
import { theme } from "../styles/theme";
import { addUserData } from "../redux/slices/auth-reducer";
import nookies from "nookies";
import axios from "axios";
import { Api, clearTokens } from "../api/Api";
import {
  setCartData,
  setProductDetails,
  loadCartFromLocalStorage,
} from "../redux/slices/cart-reducer";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { CartItem, CartProductDetails } from "../redux/Types/ProductType";

const WrappedApp = ({ Component, pageProps }: AppProps) => {
  const dispatch = useAppDispatch();
  const isLoggedIn = useAppSelector((state) => !!state.user.userData);

  useEffect(() => {
    if (!isLoggedIn) {
      dispatch(loadCartFromLocalStorage());
    }
  }, [isLoggedIn]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Component {...pageProps} />
    </ThemeProvider>
  );
};

// useWrappedStore гідрує store один раз на перехід. withRedux із
// next-redux-wrapper 7 диспатчив HYDRATE просто під час рендеру переходу,
// і React перезапускав цей рендер, поки transition не протухав (~5 с).
const App = ({ Component, ...rest }: AppProps) => {
  const { store, props } = wrapper.useWrappedStore(rest);

  return (
    <Provider store={store}>
      <WrappedApp {...props} Component={Component} />
    </Provider>
  );
};

App.getInitialProps = wrapper.getInitialAppProps((store) =>
  // @ts-ignore
  async ({ ctx, Component }) => {
    const pageProps = Component.getInitialProps
      ? await Component.getInitialProps(ctx)
      : {};

    // Next викликає App.getInitialProps на кожному переході: на сервері — для
    // /_next/data сторінок з getServerSideProps, у браузері — для решти.
    // Профіль потрібен один раз: під час першого серверного рендеру, а в
    // браузері — лише якщо користувача в store ще немає. Серверний store без
    // користувача не затре клієнтського (див. hydrate у auth- і cart-reducer).
    if (ctx.req?.url?.startsWith("/_next/data/")) return { pageProps };
    if (store.getState().user.userData) return { pageProps };

    try {
      const { token, refreshToken } = nookies.get(ctx);
      if (!token && !refreshToken) return { pageProps };

      const userData = await Api(ctx).auth.authorization();
      const { cartItems, ...userInfo } = userData;

      store.dispatch(addUserData(userInfo));

      const cartData: CartItem[] = (cartItems || []).map((item) => ({
        id: item.id,
        idProduct: item.productId,
        size: item.size,
        quantity: item.quantity,
      }));
      store.dispatch(setCartData(cartData));

      const productDetailsArr: CartProductDetails[] = (cartItems || [])
        .filter((item) => item.product)
        .map((item) => ({
          id: item.product.id,
          name: item.product.name,
          cover: item.product.cover,
          sizes: item.product.sizes || [],
          price: item.product.price,
          salePrice: item.product.salePrice ?? null,
        }));
      if (productDetailsArr.length > 0) {
        store.dispatch(setProductDetails(productDetailsArr));
      }
    } catch (e) {
      // Не логуємо e.config: у заголовках запиту є токен авторизації
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      console.error(
        `Не вдалося отримати профіль: ${status ?? "без статусу"} ${e?.message}`
      );
      if (status === 401) {
        clearTokens(ctx);
      }
    }

    return { pageProps };
  }
);

export default App;
