import { Action, configureStore, Store, ThunkAction } from "@reduxjs/toolkit";
import authReducer from "./slices/auth-reducer";
import productReducer from "./slices/product-reducer";
import { createWrapper, Context } from "next-redux-wrapper";
import cartReducer from "./slices/cart-reducer";
import ordersReducer from "./slices/orders-reducer";

const reducers = {
  product: productReducer,
  user: authReducer,
  cart: cartReducer,
  orders: ordersReducer,
};

// Створюємо новий store для кожного серверного запиту
// (next-redux-wrapper вимагає цього щоб уникнути витоку стейту між запитами)
const makeStore = (context: Context) =>
  configureStore({
    reducer: reducers,
  });

export const wrapper = createWrapper<Store<AppState>>(makeStore);

// Клієнтський store (для використання в useEffect де немає доступу до dispatch)
export const store = configureStore({
  reducer: reducers,
});

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = typeof store.dispatch;
export type AppState = ReturnType<AppStore["getState"]>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  AppState,
  unknown,
  Action
>;
