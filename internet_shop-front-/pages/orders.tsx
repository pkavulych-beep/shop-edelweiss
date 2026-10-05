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
            {data.map(({ id, items, total, status }) => {
              return (
                <div key={id}>
                  <Typography variant="h6">
                    Замовлення №{id} — {status}
                  </Typography>
                  <div>
                    {items.map(item => {
                      return (
                        <p key={item.id}>
                          {item.product?.name}, розмір {item.size} — {item.quantity} × {item.price} грн
                        </p>
                      );
                    })}
                  </div>
                  <Typography sx={{ fontWeight: 700, mb: 2 }}>
                    Разом: {total} грн
                  </Typography>
                  <Divider color="black" sx={{ mb: 2 }} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </MainLayout>
  );
};

export default Orders;
