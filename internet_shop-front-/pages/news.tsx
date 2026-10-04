import { NextPage } from 'next';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import React, { useEffect } from 'react';
import { setOrdersData } from '../redux/slices/orders-reducer';
import { MainLayout } from '../layouts/MainLayout';
import { EmptyCart } from '../components/cartComponents/emptyCart/EmptyCart';

export const News: NextPage = () => {
  const dispatch = useAppDispatch();
  const { id, data } = useAppSelector(({ user, orders }) => ({
    id: user?.userData?.id,
    data: orders?.data
  }));

  useEffect(() => {
    //??
    if (id) {
      dispatch(setOrdersData(id));
    }
  }, []);

  console.log(data);

  return (
    <MainLayout title={'новини і відгуки'}>
      {!data || data.length === 0 ? <EmptyCart /> : <div>test</div>}
    </MainLayout>
  );
};

export default News;
