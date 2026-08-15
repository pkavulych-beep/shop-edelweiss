import * as React from 'react';
import { Api } from '../../api/Api';
import { AdminWrapper } from '../../components/adminWrapper/AdminWrapper';
import CreateNewDish from '../../components/CreateNewDish/CreateNewDish';
import { ProductsList } from '../../components/ProductList';
import { MainLayout } from '../../layouts/MainLayout';
import { wrapper } from '../../redux/redux-store';
import { addDataProducts, setTotal, setErrorMessage } from '../../redux/slices/product-reducer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function NewProducts() {
  return (
    <MainLayout title="Нове — Edelweiss">
      <AdminWrapper>
        <CreateNewDish />
      </AdminWrapper>
      <Box sx={{ py: 6, px: { xs: 2, md: 6 }, textAlign: 'center', bgcolor: '#f2f4f4' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          Щойно додано
        </Typography>
        <Typography variant="h2" sx={{ fontSize: { xs: '1.5rem', md: '2.25rem' } }}>
          Нові надходження
        </Typography>
      </Box>
      <Box sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 2, md: 6 }, py: 4 }}>
        <ProductsList />
      </Box>
    </MainLayout>
  );
}

export const getServerSideProps = wrapper.getServerSideProps((store) =>
  // @ts-ignore
  async (ctx) => {
    try {
      const result = await Api().product.findFiltered({
        sort: 'newest',
        limit: 20,
      });
      store.dispatch(addDataProducts(result.data));
      store.dispatch(setTotal(result.total));
    } catch (e) {
      store.dispatch(setErrorMessage(e.message));
    }
  },
);
