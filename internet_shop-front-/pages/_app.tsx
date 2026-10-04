import "../styles/globals.css";
import * as React from "react";
import { useEffect } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { wrapper } from "../redux/redux-store";
import type { AppProps } from "next/app";
import { theme } from "../styles/theme";
import { addUserData } from "../redux/slices/auth-reducer";
import nookies from "nookies";
import { Api } from "../api/Api";
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

WrappedApp.getInitialProps = wrapper.getInitialPageProps((store) =>
  // @ts-ignore
  async ({ ctx, Component }) => {
    try {
      const { token } = nookies.get(ctx);
      if (!token) return;

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
      if (e?.config?.headers) {
        console.log(e.config.headers);
      }
    }
  }
);

export default wrapper.withRedux(WrappedApp);
