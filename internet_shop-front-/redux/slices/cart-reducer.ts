import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { HYDRATE } from 'next-redux-wrapper';
import { AppThunk } from '../redux-store';
import { Api } from '../../api/Api';
import { CartItem, CartProductDetails } from '../Types/ProductType';

const CART_LOCAL_STORAGE_KEY = 'guest_cart';

// Хелпери для localStorage
const getLocalCart = (): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(CART_LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const setLocalCart = (items: CartItem[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CART_LOCAL_STORAGE_KEY, JSON.stringify(items));
};

const clearLocalCart = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CART_LOCAL_STORAGE_KEY);
};

export const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    data: [] as CartItem[],
    productDetails: {} as Record<number, CartProductDetails>,
    loading: false,
  },
  reducers: {
    setCartData: (state, action: PayloadAction<CartItem[]>) => {
      state.data = action.payload ?? [];
    },
    addItem: (state, action: PayloadAction<CartItem>) => {
      const existing = state.data.find(
        (el) =>
          el.idProduct === action.payload.idProduct &&
          (el.size ?? "") === (action.payload.size ?? ""),
      );
      if (existing) {
        existing.quantity += action.payload.quantity;
      } else {
        state.data.push(action.payload);
      }
    },
    removeItem: (state, action: PayloadAction<{ idProduct: number; size?: string }>) => {
      if (action.payload.size) {
        state.data = state.data.filter(
          (el) =>
            !(el.idProduct === action.payload.idProduct && (el.size ?? "") === (action.payload.size ?? "")),
        );
      } else {
        state.data = state.data.filter(
          (el) => el.idProduct !== action.payload.idProduct,
        );
      }
      // Видалити кеш деталей тільки якщо товару більше немає в корзині
      const stillInCart = state.data.some(
        (el) => el.idProduct === action.payload.idProduct,
      );
      if (!stillInCart) {
        delete state.productDetails[action.payload.idProduct];
      }
    },
    setProductDetails: (state, action: PayloadAction<CartProductDetails[]>) => {
      action.payload.forEach((product) => {
        state.productDetails[product.id] = product;
      });
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
  extraReducers: {
    [HYDRATE]: (state, action) => {
      // Якщо на клієнті вже є дані корзини — не перезаписувати серверними
      // (серверний store створюється заново при кожній навігації)
      if (state.data.length > 0) return;
      state.data = action.payload.cart.data ?? [];
      state.productDetails = action.payload.cart.productDetails ?? {};
    },
  },
});

export const { setCartData, addItem, removeItem, setProductDetails, setLoading } =
  cartSlice.actions;

export default cartSlice.reducer;

// ======== Thunks ========

// Довантажити деталі товарів для корзини
export const fetchCartProductDetails =
  (): AppThunk => async (dispatch, getState) => {
    const cartItems = getState().cart.data;
    if (!cartItems || cartItems.length === 0) return;

    const ids = Array.from(new Set(cartItems.map((item) => item.idProduct)));
    const existingDetails = getState().cart.productDetails;
    const missingIds = ids.filter((id) => !existingDetails[id]);

    if (missingIds.length === 0) return;

    dispatch(setLoading(true));
    try {
      const products = await Api().product.findByIds(missingIds);
      dispatch(setProductDetails(products));
    } catch (e) {
      console.error('Failed to fetch cart product details:', e);
    } finally {
      dispatch(setLoading(false));
    }
  };

// Додати товар в корзину
export const addPositionsToCart =
  (dto: { idProduct: number; size?: string }): AppThunk =>
  async (dispatch, getState) => {
    const idUser = getState().user.userData?.id;
    const newItem: CartItem = { idProduct: dto.idProduct, size: dto.size ?? "", quantity: 1 };

    if (idUser) {
      try {
        await Api().cart.addProductToCart({
          idProduct: dto.idProduct,
          size: dto.size ?? "",
        });
      } catch (e) {
        console.error('Failed to add product to cart:', e);
        return;
      }
      dispatch(addItem(newItem));
    } else {
      // Зберігати в localStorage для незалогінених
      const currentCart = getLocalCart();
      const existing = currentCart.find(
        (el) => el.idProduct === dto.idProduct && (el.size ?? "") === (dto.size ?? ""),
      );
      if (existing) {
        existing.quantity += 1;
      } else {
        currentCart.push(newItem);
      }
      setLocalCart(currentCart);
      // localStorage — єдине джерело правди для гостей
      dispatch(setCartData(currentCart));
    }
  };

// Видалити товар з корзини
export const pickUpFromTheCart =
  (dto: { idProduct: number; size?: string; idUser?: number }): AppThunk =>
  async (dispatch) => {
    try {
      if (dto.idUser) {
        await Api().cart.pickUpFromTheBasket({
          idProduct: dto.idProduct,
          size: dto.size ?? "",
        });
        dispatch(removeItem({ idProduct: dto.idProduct, size: dto.size ?? "" }));
      } else {
        // Видалити з localStorage
        const currentCart = getLocalCart();
        const updatedCart = currentCart.filter(
          (el) => !(el.idProduct === dto.idProduct && (el.size ?? "") === (dto.size ?? "")),
        );
        setLocalCart(updatedCart);
        // localStorage — єдине джерело правди для гостей
        dispatch(setCartData(updatedCart));
      }
    } catch (e) {
      console.error('Failed to remove product from cart:', e);
    }
  };

// Очистити корзину
export const cleanTheBasket =
  (idUser: number): AppThunk =>
  async (dispatch) => {
    try {
      await Api().user.cleanTheBasket(idUser);
      dispatch(setCartData([]));
    } catch (e) {
      console.error('Failed to clean basket:', e);
    }
  };

// Синхронізувати localStorage корзину з бекендом при логіні
export const syncCartOnLogin =
  (): AppThunk =>
  async (dispatch) => {
    const localCart = getLocalCart();

    try {
      const items = localCart.map((item) => ({
        productId: item.idProduct,
        size: item.size,
        quantity: item.quantity,
      }));
      // syncCart з порожнім масивом просто поверне поточні елементи корзини
      const cartItems = await Api().cart.syncCart({ items });
      clearLocalCart();

      // Оновити Redux з результатом синхронізації
      const mappedItems: CartItem[] = cartItems.map((item: any) => ({
        id: item.id,
        idProduct: item.productId,
        size: item.size,
        quantity: item.quantity,
      }));
      dispatch(setCartData(mappedItems));
      dispatch(fetchCartProductDetails());
    } catch (e) {
      console.error('Failed to sync cart on login:', e);
    }
  };

// Завантажити корзину з localStorage для незалогінених
export const loadCartFromLocalStorage = (): AppThunk => (dispatch) => {
  const localCart = getLocalCart();
  if (localCart.length > 0) {
    dispatch(setCartData(localCart));
    dispatch(fetchCartProductDetails());
  }
};
