import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IProduct, IProductFilters, ICategory, Gender, currentProduct, photo } from '../Types/ProductType';
import { HYDRATE } from 'next-redux-wrapper';
import { AppThunk } from '../redux-store';
import { Api } from '../../api/Api';

export const productSlice = createSlice({
  name: 'product',
  initialState: {
    data: null as IProduct[],
    total: 0,
    error: null as string,
    currentProduct: null as currentProduct,
    category: { gender: 'woman' } as ICategory,
  },
  reducers: {
    addDataProducts: (state, action: PayloadAction<IProduct[]>) => {
      state.data = action.payload;
    },
    setTotal: (state, action: PayloadAction<number>) => {
      state.total = action.payload;
    },
    addNewProduct: (state, action: PayloadAction<IProduct>) => {
      if (state.data) {
        state.data.push(action.payload);
      }
    },
    setErrorMessage: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    setCurrentProduct: (state, action: PayloadAction<currentProduct>) => {
      state.currentProduct = action.payload ?? null;
    },
    setGender: (state, action: PayloadAction<Gender>) => {
      state.category.gender = action.payload;
    },
    getPhotosProduct: (state, action: PayloadAction<photo[]>) => {
      if (state.currentProduct) {
        state.currentProduct.photos = action.payload;
      }
    },
    removeProduct: (state, action: PayloadAction<number>) => {
      if (state.data) {
        state.data = state.data.filter((item) => item.id !== action.payload);
      }
      state.currentProduct = null;
    },
  },
  extraReducers: {
    [HYDRATE]: (state, action) => {
      state.data = action.payload.product.data;
      state.total = action.payload.product.total ?? 0;
      state.currentProduct = action.payload.product.currentProduct ?? null;
      state.category.gender = action.payload.product.category.gender;
    },
  },
});

export const {
  addNewProduct,
  addDataProducts,
  setTotal,
  setErrorMessage,
  setCurrentProduct,
  setGender,
  getPhotosProduct,
  removeProduct,
} = productSlice.actions;

export default productSlice.reducer;

// Thunks
export const saveNewProduct =
  (newProductData): AppThunk<Promise<{ error: string | null }>> =>
  async (dispatch) => {
    try {
      const newProduct = await Api().product.create(newProductData);
      dispatch(addNewProduct(newProduct));
      return { error: null };
    } catch (e) {
      const message = e?.response?.data?.message;
      const error = (Array.isArray(message) ? message.join(', ') : message) || e?.message || 'Не вдалося створити товар';
      dispatch(setErrorMessage(error));
      return { error };
    }
  };

export const fetchFilteredProducts =
  (filters: IProductFilters): AppThunk =>
  async (dispatch) => {
    try {
      const result = await Api().product.findFiltered(filters);
      dispatch(addDataProducts(result.data));
      dispatch(setTotal(result.total));
    } catch (e) {
      dispatch(setErrorMessage(e?.message || 'Помилка завантаження'));
    }
  };

export const fetchProduct =
  (idProduct: any): AppThunk =>
  async (dispatch, getState) => {
    const dataProduct: IProduct[] = getState().product.data;
    let product = null;
    if (!dataProduct) {
      try {
        product = await Api().product.findById(idProduct);
      } catch (e) {
        dispatch(setErrorMessage(e?.response?.data?.message || 'Товар не знайдено'));
        return { notFound: true };
      }
    } else {
      product = dataProduct.find((item) => item.id === +idProduct);
    }
    if (!product) {
      dispatch(setCurrentProduct(null));
      return;
    }
    dispatch(setCurrentProduct(product));
    try {
      const photos = await Api().product.getPhotosProduct(+idProduct);
      dispatch(getPhotosProduct(photos));
    } catch (e) {
      console.log('error photos');
    }
  };
