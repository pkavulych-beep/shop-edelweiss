import { FC, useEffect, useState } from 'react';
import * as React from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip, { ChipProps } from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import { Api } from '../../api/Api';
import { useAppSelector } from '../../redux/hooks';
import { Order, Status } from '../../redux/Types/orderType';
import { PriceBox } from '../PriceBox/PriceBox';

const statusColor: Record<Status, ChipProps['color']> = {
  [Status.Processed]: 'warning',
  [Status.Sent]: 'info',
  [Status.Received]: 'success',
  [Status.Canceled]: 'default',
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

// Ціна на момент замовлення не зберігається, тож рахуємо за поточними цінами
const orderTotal = (order: Order) =>
  order.productsInOrder.reduce(
    (sum, product) => sum + (product.salePrice ? product.salePrice : product.price),
    0
  );

const OrderCard: FC<{ order: Order }> = ({ order }) => (
  <Box
    sx={{
      border: '1px solid',
      borderColor: 'rgba(175, 179, 179, 0.3)',
      borderRadius: 3,
      p: { xs: 2, md: 3 },
    }}
  >
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 2,
        mb: 2,
      }}
    >
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
          Замовлення №{order.id}
        </Typography>
        {order.createdAt && (
          <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
            {formatDate(order.createdAt)}
          </Typography>
        )}
      </Box>
      <Chip label={order.status} color={statusColor[order.status]} size="small" />
    </Box>

    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
      Доставка: Нова пошта, {order.cityName}, {order.department}
    </Typography>

    <Box>
      {order.productsInOrder.map((product) => (
        <Box
          key={product.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            py: 1.5,
            borderTop: '1px solid',
            borderColor: 'rgba(175, 179, 179, 0.15)',
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 58,
              flexShrink: 0,
              borderRadius: 1.5,
              overflow: 'hidden',
              bgcolor: '#eceeee',
            }}
          >
            {product.cover && (
              <img
                src={product.cover}
                alt={product.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Link href={'/product/' + product.id}>
              <a style={{ textDecoration: 'none', color: 'inherit' }}>
                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  {product.name}
                </Typography>
              </a>
            </Link>
            {order.size && (
              <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                Розмір: {order.size}
              </Typography>
            )}
          </Box>
          <PriceBox price={product.price} salePrice={product.salePrice} />
        </Box>
      ))}
    </Box>

    {order.comment && (
      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 1 }}>
        Коментар: {order.comment}
      </Typography>
    )}

    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        borderTop: '1px solid',
        borderColor: 'rgba(175, 179, 179, 0.3)',
        mt: 1.5,
        pt: 1.5,
      }}
    >
      <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
        Сума
      </Typography>
      <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
        {orderTotal(order)} грн
      </Typography>
    </Box>
  </Box>
);

// Список замовлень поточного користувача: і в профілі, і на /orders
export const MyOrders: FC = () => {
  const userId = useAppSelector((state) => state.user.userData?.id);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setOrders(null);
    setError(false);
    Api()
      .orders.findMy()
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (error) {
    return <Alert severity="error">Не вдалося завантажити замовлення. Спробуйте пізніше.</Alert>;
  }

  if (!orders) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (orders.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, bgcolor: '#f2f4f4', borderRadius: 3 }}>
        <ShoppingBagOutlinedIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
          У вас ще немає замовлень
        </Typography>
        <Link href={`/productsList/woman`}>
          <a style={{ textDecoration: 'none' }}>
            <Button variant="text" sx={{ mt: 2, color: 'primary.main' }}>
              Перейти до каталогу
            </Button>
          </a>
        </Link>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </Box>
  );
};
