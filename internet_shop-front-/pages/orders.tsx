import { NextPage } from 'next';
import { setOrdersData } from '../redux/slices/orders-reducer';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import React, { useEffect } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { EmptyCart } from '../components/cartComponents/emptyCart/EmptyCart';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';

export const Orders: NextPage = () => {
  const dispatch = useAppDispatch();
  const { id, data } = useAppSelector(({ user, orders }) => ({
    id: user.userData?.id,
    data: orders.data
  }));

  useEffect(() => {
    if (id) {
      dispatch(setOrdersData(id));
    }
  }, [id]);

  return (
    <MainLayout title={'замовлення'}>
      {!data || data.length === 0 ? (
        <EmptyCart title='Ви ще не здійснили жодної покупки' />
      ) : (
        <>
          <Typography variant="h4" align="center" sx={{ marginTop: 3 }}>
            Ваші замовлення
          </Typography>
          <div style={{ margin: '20px' }}>
            {data.map(({ id, cityName, comment, productsInOrder, status }) => {
              return (
                <div key={id}>
                  <div>
                    {productsInOrder.map(product => {
                      return <p key={product.id}>{product.name}</p>;
                    })}
                  </div>
                </div>
              );
            })}
            <Divider color="black" />
          </div>
        </>
      )}
    </MainLayout>
  );
};

export default Orders;
