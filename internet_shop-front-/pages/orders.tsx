import { NextPage } from 'next';
import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useAppSelector } from '../redux/hooks';
import { MainLayout } from '../layouts/MainLayout';
import { MyOrders } from '../components/MyOrders/MyOrders';

export const Orders: NextPage = () => {
  const isAuth = useAppSelector(({ user }) => Boolean(user.userData));

  return (
    <MainLayout title={'замовлення'}>
      <Box sx={{ maxWidth: 600, mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 3, md: 6 } }}>
        <Typography variant="h4" sx={{ fontSize: '1.5rem', mb: 3 }}>
          Мої замовлення
        </Typography>
        {isAuth ? (
          <MyOrders />
        ) : (
          <Typography sx={{ color: 'text.secondary' }}>
            Увійдіть в акаунт, щоб переглянути свої замовлення
          </Typography>
        )}
      </Box>
    </MainLayout>
  );
};

export default Orders;
