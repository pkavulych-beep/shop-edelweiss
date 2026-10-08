import { NextPage } from 'next';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import React, { useEffect } from 'react';
import { setOrdersData } from '../redux/slices/orders-reducer';
import { MainLayout } from '../layouts/MainLayout';
import { EmptyCart } from '../components/cartComponents/emptyCart/EmptyCart';

export const News: NextPage = () => {
  const dispatch = useAppDispatch();
  const id = useAppSelector(({ user }) => user?.userData?.id);
  const data = useAppSelector(({ orders }) => orders?.data);

  useEffect(() => {
    //??
    if (id) {
      dispatch(setOrdersData());
    }
  }, []);

  return (
    <MainLayout title={'новини і відгуки'}>
      {!data || data.length === 0 ? <EmptyCart /> : <div>test</div>}
    </MainLayout>
  );
};

export default News;
