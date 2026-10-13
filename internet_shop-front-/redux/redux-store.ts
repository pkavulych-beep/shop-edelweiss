import {
  Action,
  configureStore,
  Store,
  StoreEnhancer,
  ThunkAction,
} from "@reduxjs/toolkit";
import authReducer from "./slices/auth-reducer";
import productReducer from "./slices/product-reducer";
import { createWrapper, Context, HYDRATE } from "next-redux-wrapper";
import cartReducer from "./slices/cart-reducer";
import ordersReducer from "./slices/orders-reducer";

const reducers = {
  product: productReducer,
  user: authReducer,
  cart: cartReducer,
  orders: ordersReducer,
};

// wrapper.useWrappedStore диспатчить HYDRATE під час рендеру App. Якщо в цей
// момент синхронно сповістити підписників, React оновлює інші компоненти
// посеред рендеру («Cannot update a component while rendering a different
// component»). Тому про HYDRATE сповіщаємо мікрозадачею: компоненти, які
// рендеряться після App, і так читають новий стан.
const deferHydrateNotifications: StoreEnhancer =
  (createStore) => (reducer, preloadedState) => {
    const store = createStore(reducer, preloadedState);
    let hydrating = false;

    const dispatch: typeof store.dispatch = (action) => {
      if (action.type !== HYDRATE) return store.dispatch(action);
      hydrating = true;
      try {
        return store.dispatch(action);
      } finally {
        hydrating = false;
      }
    };

    const subscribe: typeof store.subscribe = (listener) =>
      store.subscribe(() => {
        if (hydrating) queueMicrotask(listener);
        else listener();
      });

    return { ...store, dispatch, subscribe };
  };

// Створюємо новий store для кожного серверного запиту
// (next-redux-wrapper вимагає цього щоб уникнути витоку стейту між запитами)
const makeStore = (context: Context) =>
  configureStore({
    reducer: reducers,
    enhancers: (getDefaultEnhancers) =>
      getDefaultEnhancers().concat(deferHydrateNotifications),
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
