import { FC } from 'react';
import { useRouter } from 'next/router';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Pagination from '@mui/material/Pagination';
import { useAppSelector } from '../../redux/hooks';
import { pluralizeProduct } from '../../utils/plural';
import { ProductsList } from './index';

export const PRODUCT_LIST_LIMIT = 20;

export const PaginatedProducts: FC = () => {
  const router = useRouter();
  const query = router.query as Record<string, string>;
  const total = useAppSelector((store) => store.product.total);
  const totalPages = Math.ceil(total / PRODUCT_LIST_LIMIT);
  const currentPage = Number(query.page) || 1;

  const handlePageChange = (_: unknown, page: number) => {
    router.push({
      pathname: router.pathname,
      query: { ...query, page: page.toString() },
    });
  };

  if (!total) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography variant="h6" sx={{ color: 'text.secondary', mb: 2 }}>
          Нічого не знайдено
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <ProductsList />
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 6 }}>
          <Pagination count={totalPages} page={currentPage} onChange={handlePageChange} />
        </Box>
      )}
    </>
  );
};
