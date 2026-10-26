import { MainLayout } from '../../layouts/MainLayout';
import { wrapper } from '../../redux/redux-store';
import { addDataProducts, setTotal, setErrorMessage, setGender, setFilters } from '../../redux/slices/product-reducer';
import { AdminWrapper } from '../../components/adminWrapper/AdminWrapper';
import CreateNewDish from '../../components/CreateNewDish/CreateNewDish';
import { ProductsList } from '../../components/ProductList';
import FilterSidebar from '../../components/FilterSidebar/FilterSidebar';
import AppliedFilters from '../../components/FilterSidebar/AppliedFilters';
import { useAppSelector } from '../../redux/hooks';
import { Api } from '../../api/Api';
import { useRouter } from 'next/router';
import * as React from 'react';
import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Pagination from '@mui/material/Pagination';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import { pluralizeProduct } from '../../utils/plural';

const LIMIT = 20;

const genderTitles: Record<string, string> = {
  man: 'Чоловікам',
  woman: 'Жінкам',
};

export default function Index() {
  const router = useRouter();
  const query = router.query as Record<string, string>;
  const total = useAppSelector((store) => store.product.total);
  const error = useAppSelector((store) => store.product.error);
  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Number(query.page) || 1;
  const genderTitle = genderTitles[query.gender as string] || 'Каталог';
  const gender = query.gender as string;

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const handlePageChange = (_: any, page: number) => {
    router.push({
      pathname: router.pathname,
      query: { ...query, page: page.toString() },
    });
  };

  const handleRemoveFilter = (key: string) => {
    const newQuery = { ...query };
    delete newQuery[key];
    delete newQuery.page;
    router.push({ pathname: router.pathname, query: newQuery });
  };

  const handleClearAll = () => {
    router.push({
      pathname: router.pathname,
      query: { gender: query.gender },
    });
  };

  return (
    <MainLayout title={`${genderTitle} — Edelweiss`}>
      <AdminWrapper>
        <CreateNewDish />
      </AdminWrapper>

      {/* Page Header */}
      <Box
        sx={{
          py: 6,
          px: { xs: 2, md: 6 },
          textAlign: 'center',
          bgcolor: '#f2f4f4',
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', display: 'block', mb: 1 }}
        >
          Колекція
        </Typography>
        <Typography
          variant="h2"
          sx={{ fontSize: { xs: '1.5rem', md: '2.25rem' } }}
        >
          {genderTitle}
        </Typography>
        {total > 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            {total} {pluralizeProduct(total)}
          </Typography>
        ) : error ? (
          <Typography variant="body2" sx={{ color: 'error.main', mt: 1 }}>
            {error}
          </Typography>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            Нічого не знайдено
          </Typography>
        )}
      </Box>

      {/* Mobile filter button */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          px: 2,
          pt: 2,
          gap: 1,
          alignItems: 'center',
        }}
      >
        <Button
          variant="outlined"
          startIcon={<TuneIcon />}
          onClick={() => setMobileFiltersOpen(true)}
          sx={{
            borderColor: 'rgba(175, 179, 179, 0.3)',
            color: 'text.primary',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            borderRadius: 2,
            py: 1,
          }}
        >
          Фільтри
        </Button>
      </Box>

      {/* Mobile filter drawer */}
      <Drawer
        anchor="bottom"
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 3,
            pt: 2,
            pb: 2,
          }}
        >
          <Typography variant="h5" sx={{ fontSize: '1rem' }}>
            Фільтри
          </Typography>
          <IconButton onClick={() => setMobileFiltersOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 3 }}>
          <FilterSidebar gender={gender} />
        </Box>
        <Box sx={{ px: 3, pt: 2, pb: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            variant="contained"
            fullWidth
            onClick={() => setMobileFiltersOpen(false)}
            sx={{ py: 1.5, borderRadius: 2 }}
          >
            Показати результати
          </Button>
        </Box>
      </Drawer>

      {/* Content */}
      <Box
        sx={{
          display: 'flex',
          gap: 4,
          px: { xs: 2, md: 6 },
          py: 4,
          maxWidth: 1440,
          mx: 'auto',
        }}
      >
        {/* Sidebar - desktop only */}
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <FilterSidebar gender={gender} />
        </Box>

        {/* Products */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <AppliedFilters
            filters={query}
            onRemove={handleRemoveFilter}
            onClearAll={handleClearAll}
          />
          {total > 0 ? (
            <>
              <ProductsList />
              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 6 }}>
                  <Pagination
                    count={totalPages}
                    page={currentPage}
                    onChange={handlePageChange}
                  />
                </Box>
              )}
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" sx={{ color: 'text.secondary', mb: 2 }}>
                Нічого не знайдено
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Спробуйте змінити параметри пошуку або скиньте фільтри
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </MainLayout>
  );
}

export const getServerSideProps = wrapper.getServerSideProps((store) =>
  // @ts-ignore
  async ({ params: { gender }, query }) => {
    // Невідома стать (наприклад /productsList/foo) — справжня сторінка 404
    if (gender !== 'man' && gender !== 'woman') {
      return { notFound: true };
    }
    try {
      const filters = {
        gender: gender as string,
        sort: 'newest',
        ...query,
        limit: LIMIT,
      };
      const result = await Api().product.findFiltered(filters);
      store.dispatch(setFilters(filters));
      store.dispatch(addDataProducts(result.data));
      store.dispatch(setTotal(result.total));
      // @ts-ignore
      store.dispatch(setGender(gender));
    } catch (e) {
      // Помилка бека (5xx, бек недоступний) — не 404, а повідомлення на сторінці
      store.dispatch(setErrorMessage('Не вдалося завантажити товари'));
      store.dispatch(setTotal(0));
    }
  },
);
