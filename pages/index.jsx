import { ProductsList } from '../components/ProductList';
import { addDataProducts, setTotal, setErrorMessage } from '../redux/slices/product-reducer';
import { wrapper } from '../redux/redux-store';
import { MainLayout } from '../layouts/MainLayout';
import { Api } from '../api/Api';
import { AdminWrapper } from '../components/adminWrapper/AdminWrapper';
import CreateNewDish from '../components/CreateNewDish/CreateNewDish';
import Hero from '../components/Hero/Hero';
import SaleBanner from '../components/SaleBanner/SaleBanner';
import CategoryCards from '../components/CategoryCards/CategoryCards';
import BrandStory from '../components/BrandStory/BrandStory';
import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function Home() {
  return (
    <MainLayout>
      <Hero />

      <AdminWrapper>
        <CreateNewDish />
      </AdminWrapper>

      {/* New Arrivals Section */}
      <Box
        sx={{
          maxWidth: 1440,
          mx: 'auto',
          px: { xs: 2, md: 6 },
          py: { xs: 4, md: 8 },
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              color: 'text.secondary',
              mb: 1,
            }}
          >
            Щойно додано
          </Typography>
          <Typography variant="h3" sx={{ fontSize: { xs: '1.25rem', md: '1.875rem' } }}>
            Нові надходження
          </Typography>
        </Box>
        <ProductsList />
      </Box>

      {/* Sale Banner */}
      <SaleBanner />

      {/* Category Cards */}
      <CategoryCards />

      {/* Brand Story */}
      <BrandStory />
    </MainLayout>
  );
}

export const getServerSideProps = wrapper.getServerSideProps(store => async cnx => {
  try {
    const result = await Api(cnx).product.findFiltered({ limit: 12 });
    store.dispatch(addDataProducts(result.data));
    store.dispatch(setTotal(result.total));
  } catch (e) {
    store.dispatch(setErrorMessage(e.message));
  }
});
