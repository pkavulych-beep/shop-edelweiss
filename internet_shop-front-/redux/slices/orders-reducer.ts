import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { hydrate } from '../hydrate';
import { AppThunk } from '../redux-store';
import { Api } from '../../api/Api';
import { Order } from '../Types/orderType';

export const ordersSlice = createSlice({
  name: 'orders',
  initialState: {
    data: null as Order[],
  },
  reducers: {
    addOrdersData: (state, action: PayloadAction<Order[] | null>) => {
      state.data = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(hydrate, (state, action) => {
      state.data = action.payload.orders.data;
    });
  },
});

export const { addOrdersData } = ordersSlice.actions;

export default ordersSlice.reducer;

// Thunks
export const setOrdersData = (): AppThunk<Promise<void>> => async (dispatch) => {
  const orders = await Api().orders.findMy();
  dispatch(addOrdersData(orders));
};
