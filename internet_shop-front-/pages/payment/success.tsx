import { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Link from 'next/link';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import { MainLayout } from '../../layouts/MainLayout';
import { Api } from '../../api/Api';
import { PaymentStatus, PaymentMethod, Status } from '../../redux/Types/orderType';
import { getPaymentChipLabel, isCardUnpaid } from '../../components/MyOrders/MyOrders';

export const PaymentSuccess: NextPage = () => {
  const router = useRouter();
  const { orderId } = router.query;
  const id = typeof orderId === 'string' ? Number(orderId) : NaN;
  const validId = Number.isInteger(id) && id >= 1;

  const [loading, setLoading] = useState(validId);
  const [error, setError] = useState<string | null>(validId ? null : 'Не знайдено або невірний ідентифікатор замовлення');
  const [order, setOrder] = useState<{
    id: number;
    status: Status;
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
  } | null>(null);

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;
    Api()
      .orders.findById(id)
      .then((data) => {
        if (!cancelled) {
          setOrder({
            id: data.id,
            status: data.status,
            paymentStatus: data.paymentStatus,
            paymentMethod: data.paymentMethod,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Не вдалося перевірити статус оплати. Спробуйте пізніше.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [validId, id]);

  if (loading) {
    return (
      <MainLayout title='Оплата'>
        <Box sx={{ maxWidth: 500, mx: 'auto', px: 2, py: 6, textAlign: 'center' }}>
          <CircularProgress size={48} />
          <Typography variant="body1" sx={{ mt: 2, color: 'text.secondary' }}>
            Перевіряємо статус оплати…
          </Typography>
        </Box>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout title='Оплата'>
        <Box sx={{ maxWidth: 500, mx: 'auto', px: 2, py: 6 }}>
          <Alert severity="error">{error}</Alert>
          <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Link href="/orders">
              <Button variant="outlined">Мої замовлення</Button>
            </Link>
          </Box>
        </Box>
      </MainLayout>
    );
  }

  const isPaid = order?.paymentStatus === PaymentStatus.Paid;
  // Скасоване замовлення бек оплатити не дасть
  const showRetry =
    !!order &&
    order.status !== Status.Canceled &&
    isCardUnpaid(order.paymentMethod, order.paymentStatus);

  const handleRetryPayment = async () => {
    if (!order) return;
    try {
      const { pageUrl } = await Api().payment.createInvoice(order.id);
      window.location.href = pageUrl;
    } catch (e) {
      const message = e?.response?.data?.message;
      const details = String(Array.isArray(message) ? message.join('. ') : message || '')
        .trim()
        .replace(/\.$/, '');
      setError(
        'Не вдалося перейти до оплати.' +
          (details ? ` ${details}.` : '') +
          ' Спробуйте пізніше.'
      );
    }
  };

  return (
    <MainLayout title={isPaid ? 'Оплата успішна' : 'Оплата не підтверджена'}>
      <Box sx={{ maxWidth: 500, mx: 'auto', px: 2, py: 6, textAlign: 'center' }}>
        {isPaid ? (
          <>
            <CheckCircleOutlinedIcon
              sx={{ fontSize: 80, color: 'success.main', mb: 2 }}
            />
            <Typography variant="h4" sx={{ fontSize: '1.5rem', mb: 1 }}>
              Дякуємо за оплату!
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
              Ваше замовлення №{order?.id} оплачено. Статус: <strong>Оплачено</strong>.
            </Typography>
          </>
        ) : (
          <>
            <Alert severity="warning" sx={{ mb: 3 }}>
              Оплата ще не підтверджена. Статус: {order ? getPaymentChipLabel(order.paymentMethod, order.paymentStatus, order.status) : 'невідомо'}.
            </Alert>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
              Якщо ви оплатили замовлення, статус оновиться протягом декілька хвилин.
            </Typography>
          </>
        )}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/orders">
            <Button variant="contained" size="large">
              Мої замовлення
            </Button>
          </Link>
          {showRetry && (
            <Button variant="outlined" size="large" onClick={handleRetryPayment}>
              Повторити оплату
            </Button>
          )}
        </Box>
      </Box>
    </MainLayout>
  );
};

export default PaymentSuccess;