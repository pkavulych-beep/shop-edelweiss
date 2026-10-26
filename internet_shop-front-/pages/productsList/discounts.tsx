import { MainLayout } from '../../layouts/MainLayout';
import { wrapper } from '../../redux/redux-store';
import { addDataProducts, setTotal, setErrorMessage, setFilters } from '../../redux/slices/product-reducer';
import { AdminWrapper } from '../../components/adminWrapper/AdminWrapper';
import CreateNewDish from '../../components/CreateNewDish/CreateNewDish';
import { PaginatedProducts, PRODUCT_LIST_LIMIT } from '../../components/ProductList/PaginatedProducts';
import { useAppSelector } from '../../redux/hooks';
import { pluralizeProduct } from '../../utils/plural';
import { Api } from '../../api/Api';
import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function DiscountsProductsList() {
  const total = useAppSelector((store) => store.product.total);

  return (
    <MainLayout title="Знижки — Edelweiss">
      <AdminWrapper>
        <CreateNewDish />
      </AdminWrapper>
      <Box sx={{ py: 6, px: { xs: 2, md: 6 }, textAlign: 'center', bgcolor: '#f2f4f4' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          Спеціальні пропозиції
        </Typography>
        <Typography variant="h2" sx={{ fontSize: { xs: '1.5rem', md: '2.25rem' } }}>
          Знижки
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          {total > 0 ? `${total} ${pluralizeProduct(total)}` : 'Нічого не знайдено'}
        </Typography>
      </Box>
      <Box sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 2, md: 6 }, py: 4 }}>
        <PaginatedProducts />
      </Box>
    </MainLayout>
  );
}

export const getServerSideProps = wrapper.getServerSideProps((store) =>
  // @ts-ignore
  async ({ query }) => {
    try {
      const rawPage = Number(query.page);
      const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
      const filters = {
        onSale: true,
        limit: PRODUCT_LIST_LIMIT,
        page,
      };
      const result = await Api().product.findFiltered(filters);
      store.dispatch(setFilters(filters));
      store.dispatch(addDataProducts(result.data));
      store.dispatch(setTotal(result.total));
    } catch (e) {
      store.dispatch(setErrorMessage(e.message));
    }
  },
);
