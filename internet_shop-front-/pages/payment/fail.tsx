import { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Link from 'next/link';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { MainLayout } from '../../layouts/MainLayout';
import { Api } from '../../api/Api';
import { PaymentStatus } from '../../redux/Types/orderType';

export const PaymentFail: NextPage = () => {
  const router = useRouter();
  const { orderId } = router.query;
  const id = typeof orderId === 'string' ? Number(orderId) : NaN;
  const validId = Number.isInteger(id) && id >= 1;

  const [loading, setLoading] = useState(validId);
  const [error, setError] = useState<string | null>(validId ? null : 'Не знайдено або невірний ідентифікатор замовлення');
  const [order, setOrder] = useState<{ id: number; paymentStatus: PaymentStatus } | null>(null);

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;
    Api()
      .orders.findById(id)
      .then((data) => {
        if (!cancelled) {
          setOrder({ id: data.id, paymentStatus: data.paymentStatus });
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

  return (
    <MainLayout title={isPaid ? 'Оплата успішна' : 'Оплата не пройшла'}>
      <Box sx={{ maxWidth: 500, mx: 'auto', px: 2, py: 6, textAlign: 'center' }}>
        {isPaid ? (
          <>
            <ErrorOutlineOutlinedIcon
              sx={{ fontSize: 80, color: 'success.main', mb: 2 }}
            />
            <Typography variant="h4" sx={{ fontSize: '1.5rem', mb: 1 }}>
              Оплата все ж пройшла!
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
              Ваше замовлення №{order?.id} оплачено. Статус: <strong>Оплачено</strong>.
            </Typography>
          </>
        ) : (
          <>
            <ErrorOutlineOutlinedIcon
              sx={{ fontSize: 80, color: 'error.main', mb: 2 }}
            />
            <Typography variant="h4" sx={{ fontSize: '1.5rem', mb: 1 }}>
              Оплата не пройшла
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
              Статус оплати: {order?.paymentStatus ?? 'невідомо'}.
              Спробуйте ще раз або оберіть інший спосіб оплати.
            </Typography>
          </>
        )}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/orders">
            <Button variant="outlined" size="large">
              Мої замовлення
            </Button>
          </Link>
          {order && (
            <Link href={`/cart`}>
              <Button variant="contained" size="large">
                Повторити оплату
              </Button>
            </Link>
          )}
        </Box>
      </Box>
    </MainLayout>
  );
};

export default PaymentFail;