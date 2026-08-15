import { NextPage } from 'next';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import * as React from 'react';
import { useEffect } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { Position } from '../components/cartComponents/position/position';
import { EmptyCart } from '../components/cartComponents/emptyCart/EmptyCart';
import { Sum } from '../components/cartComponents/sum/sum';
import { Ordering } from '../components/cartComponents/ordering/Ordering';
import {
  fetchCartProductDetails,
  loadCartFromLocalStorage,
} from '../redux/slices/cart-reducer';

const Cart: NextPage = () => {
  const dispatch = useAppDispatch();
  const { data, productDetails, loading } = useAppSelector((store) => store.cart);
  const isLoggedIn = useAppSelector((store) => !!store.user.userData);

  useEffect(() => {
    if (!isLoggedIn) {
      dispatch(loadCartFromLocalStorage());
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (data && data.length > 0) {
      dispatch(fetchCartProductDetails());
    }
  }, [data?.length]);

  const enrichedProducts = data
    ? data
        .map((item) => {
          const details = productDetails[item.idProduct];
          if (!details) return null;
          return {
            ...details,
            selectedSize: item.size,
            quantity: item.quantity,
          };
        })
        .filter(Boolean)
    : [];

  const allDetailsLoaded = data ? enrichedProducts.length === data.length : true;

  return (
    <MainLayout title="Кошик — Edelweiss">
      {!data || data.length === 0 ? (
        <EmptyCart />
      ) : loading || !allDetailsLoaded ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}>
          <CircularProgress sx={{ color: 'primary.main' }} />
        </Box>
      ) : (
        <Box sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 2, md: 6 }, py: 4 }}>
          {/* Page title */}
          <Typography
            variant="h2"
            sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, mb: 6 }}
          >
            Checkout
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '7fr 5fr' },
              gap: { xs: 4, lg: 8 },
            }}
          >
            {/* Left: Order form */}
            <Box>
              <Ordering productIdArr={enrichedProducts.map((product) => product.id)} />
            </Box>

            {/* Right: Order summary */}
            <Box>
              <Box
                sx={{
                  position: { lg: 'sticky' },
                  top: { lg: 112 },
                  bgcolor: '#ffffff',
                  borderRadius: 3,
                  p: { xs: 3, md: 5 },
                  boxShadow: '0px 24px 48px rgba(47, 51, 52, 0.06)',
                  border: '1px solid rgba(175, 179, 179, 0.05)',
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    mb: 3,
                    pb: 3,
                    borderBottom: '1px solid rgba(175, 179, 179, 0.1)',
                  }}
                >
                  Ваше замовлення
                </Typography>

                {/* Cart items */}
                {enrichedProducts.map((product) => (
                  <Position
                    key={`${product.id}-${product.selectedSize}`}
                    id={product.id}
                    name={product.name}
                    size={product.selectedSize}
                    price={product.price}
                    cover={product.cover}
                    salePrice={product.salePrice}
                    quantity={product.quantity}
                  />
                ))}

                {/* Price breakdown */}
                <Box
                  sx={{
                    pt: 3,
                    mt: 2,
                    borderTop: '1px solid rgba(175, 179, 179, 0.1)',
                  }}
                >
                  <Sum items={data} productDetails={productDetails} />
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </MainLayout>
  );
};

export default Cart;
