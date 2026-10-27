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
import PaymentIcon from '@mui/icons-material/Payment';
import { Api } from '../../api/Api';
import { useAppSelector } from '../../redux/hooks';
import { Order, Status, PaymentMethod, PaymentStatus } from '../../redux/Types/orderType';
import { formatDelivery } from '../../utils/delivery';
import { useCardPaymentAvailable } from '../../hooks/useCardPaymentAvailable';

export const statusColor: Record<Status, ChipProps['color']> = {
  [Status.Processed]: 'warning',
  [Status.Sent]: 'info',
  [Status.Received]: 'success',
  [Status.Canceled]: 'default',
};

export const paymentStatusColor: Record<PaymentStatus, ChipProps['color']> = {
  [PaymentStatus.NotRequired]: 'default',
  [PaymentStatus.Pending]: 'warning',
  [PaymentStatus.Paid]: 'success',
  [PaymentStatus.Failed]: 'error',
  [PaymentStatus.Refunded]: 'info',
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  [PaymentStatus.NotRequired]: 'Оплата при отриманні',
  [PaymentStatus.Pending]: 'Очікує оплати',
  [PaymentStatus.Paid]: 'Оплачено',
  [PaymentStatus.Failed]: 'Не сплачено',
  [PaymentStatus.Refunded]: 'Повернено',
};

// Допоміжні функції для відображення статусу оплати
// Для скасованих замовлень показуємо «Скасовано» лише для статусів, що очікують оплати
// PAID і REFUNDED залишаємо як є (адмін/покупець мають бачити, що гроші були сплачені/повернені)
const canceledPaymentStatuses: PaymentStatus[] = [
  PaymentStatus.NotRequired,
  PaymentStatus.Pending,
  PaymentStatus.Failed,
];

export const getPaymentChipLabel = (paymentMethod: PaymentMethod, paymentStatus: PaymentStatus, status?: Status): string => {
  if (status === Status.Canceled && canceledPaymentStatuses.includes(paymentStatus)) return 'Скасовано';
  if (paymentMethod === PaymentMethod.Card) {
    // CARD-замовлення лишається NOT_REQUIRED, якщо інвойс не створився: оплати ще не було
    return paymentStatus === PaymentStatus.NotRequired
      ? paymentStatusLabel[PaymentStatus.Pending]
      : paymentStatusLabel[paymentStatus];
  }
  return paymentStatusLabel[PaymentStatus.NotRequired];
};

export const getPaymentChipColor = (paymentMethod: PaymentMethod, paymentStatus: PaymentStatus, status?: Status): ChipProps['color'] => {
  if (status === Status.Canceled && canceledPaymentStatuses.includes(paymentStatus)) return 'default';
  if (paymentMethod === PaymentMethod.Card) {
    return paymentStatus === PaymentStatus.NotRequired
      ? paymentStatusColor[PaymentStatus.Pending]
      : paymentStatusColor[paymentStatus];
  }
  return paymentStatusColor[PaymentStatus.NotRequired];
};

// Чи замовлення неоплачене карткою (для підсвітки в адмінці і кнопки «Сплатити»)
// Скасовані замовлення не підсвічуються, бо не потребують уваги
// Показує кнопку для: Pending, NotRequired, Failed (після невдалої оплати покупець може спробувати ще раз)
export const isCardUnpaid = (paymentMethod: PaymentMethod, paymentStatus: PaymentStatus, status?: Status): boolean => {
  if (status === Status.Canceled) return false;
  return paymentMethod === PaymentMethod.Card &&
    paymentStatus !== PaymentStatus.Paid &&
    paymentStatus !== PaymentStatus.Refunded;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const OrderCard: FC<{ order: Order; cardPaymentAvailable: boolean }> = ({
  order,
  cardPaymentAvailable,
}) => {
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const handlePay = async () => {
    if (!isCardUnpaid(order.paymentMethod, order.paymentStatus, order.status)) return;
    setPayLoading(true);
    setPayError(null);
    try {
      const { pageUrl } = await Api().payment.createInvoice(order.id);
      window.location.href = pageUrl;
    } catch (e) {
      const message = e?.response?.data?.message;
      const details = String(Array.isArray(message) ? message.join('. ') : message || '')
        .trim()
        .replace(/\.$/, '');
      setPayError(
        `Не вдалося створити інвойс для оплати.` +
          (details ? ` ${details}.` : '') +
          ' Спробуйте пізніше.'
      );
    } finally {
      setPayLoading(false);
    }
  };

  const showPayButton =
    cardPaymentAvailable &&
    isCardUnpaid(order.paymentMethod, order.paymentStatus, order.status);

  return (
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
          flexWrap: 'wrap',
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
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label={order.status} color={statusColor[order.status]} size="small" />
          <Chip
            label={getPaymentChipLabel(order.paymentMethod, order.paymentStatus, order.status)}
            color={getPaymentChipColor(order.paymentMethod, order.paymentStatus, order.status)}
            size="small"
          />
        </Box>
      </Box>

      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
        Доставка: {formatDelivery(order)}
      </Typography>

      <Box>
        {order.items.map(({ id, product, size, quantity, price }) => (
          <Box
            key={id}
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
              {product.coverThumb || product.cover ? (
                <img
                  src={product.coverThumb || product.cover}
                  alt={product.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : null}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Link href={'/product/' + product.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  {product.name}
                </Typography>
              </Link>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                {size ? `Розмір: ${size} · ` : ''}{quantity} шт.
              </Typography>
            </Box>
            {/* Ціна за одиницю на момент покупки */}
            <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
              {quantity > 1 ? `${quantity} × ${price}` : price} грн
            </Typography>
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
          {order.total} грн
        </Typography>
      </Box>

      {showPayButton && (
        <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'rgba(175, 179, 179, 0.15)' }}>
          {payError && (
            <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.8rem' }}>
              {payError}
            </Alert>
          )}
          <Button
            variant="contained"
            startIcon={<PaymentIcon fontSize="small" />}
            onClick={handlePay}
            disabled={payLoading}
            sx={{ py: 1.2, borderRadius: 2, fontWeight: 600 }}
            fullWidth
          >
            {payLoading ? 'Перенаправлення...' : `Сплатити ${order.total} грн`}
          </Button>
        </Box>
      )}
    </Box>
  );
};

// Список замовлень поточного користувача: і в профілі, і на /orders
export const MyOrders: FC = () => {
  const userId = useAppSelector((state) => state.user.userData?.id);
  const cardPaymentAvailable = useCardPaymentAvailable();
  // Результат прив'язаний до користувача, тож після зміни акаунта старі замовлення не показуємо
  const [loaded, setLoaded] = useState<{ userId: number; orders?: Order[]; error?: boolean } | null>(
    null
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Api()
      .orders.findMy()
      .then((data) => {
        if (!cancelled) setLoaded({ userId, orders: data });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ userId, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const current = loaded?.userId === userId ? loaded : null;
  const orders = current?.orders ?? null;
  const error = current?.error ?? false;

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
        <Link href={`/productsList/woman`} style={{ textDecoration: 'none' }}>
          <Button variant="text" sx={{ mt: 2, color: 'primary.main' }}>
            Перейти до каталогу
          </Button>
        </Link>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          cardPaymentAvailable={cardPaymentAvailable}
        />
      ))}
    </Box>
  );
};
