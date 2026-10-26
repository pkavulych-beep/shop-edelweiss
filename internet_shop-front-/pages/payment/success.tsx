import { NextPage } from 'next';
import { useEffect, useRef, useState } from 'react';
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
import { Order, PaymentStatus, PaymentMethod, Status } from '../../redux/Types/orderType';
import { getPaymentChipLabel, isCardUnpaid } from '../../components/MyOrders/MyOrders';
import { useCardPaymentAvailable } from '../../hooks/useCardPaymentAvailable';

// mono повертає покупця до оплати раніше, ніж приходить вебхук,
// тож статус перевіряємо самі, поки не мине час очікування.
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 30000;

type PaymentOrder = Pick<Order, 'id' | 'status' | 'paymentStatus' | 'paymentMethod'>;

const toPaymentOrder = (data: Order): PaymentOrder => ({
  id: data.id,
  status: data.status,
  paymentStatus: data.paymentStatus,
  paymentMethod: data.paymentMethod,
});

// Оплата карткою ще може підтвердитися: рахунок створено (PENDING)
// або замовлення чекає на перший інвойс (NOT_REQUIRED для CARD).
const isAwaitingPayment = (order: PaymentOrder): boolean =>
  order.paymentMethod === PaymentMethod.Card &&
  (order.paymentStatus === PaymentStatus.Pending ||
    order.paymentStatus === PaymentStatus.NotRequired);

export const PaymentSuccess: NextPage = () => {
  const router = useRouter();
  const cardPaymentAvailable = useCardPaymentAvailable();
  const { orderId } = router.query;
  const id = typeof orderId === 'string' ? Number(orderId) : NaN;
  const validId = Number.isInteger(id) && id >= 1;

  // Стан прив'язаний до id, щоб відповідь на попереднє замовлення
  // не показалася для нового.
  const [loaded, setLoaded] = useState<{
    id: number;
    order?: PaymentOrder;
    error?: string;
    expired?: boolean;
  } | null>(null);
  const deadlineRef = useRef<{ id: number; at: number } | null>(null);

  const current = loaded?.id === id ? loaded : null;
  const order = current?.order ?? null;
  const error = !router.isReady
    ? null
    : !validId
    ? 'Не знайдено або невірний ідентифікатор замовлення'
    : current?.error ?? null;
  const waitingExpired = current?.expired === true;
  const loading = !router.isReady || (validId && !current);

  useEffect(() => {
    if (!router.isReady || !validId) return;
    // Відповідь на попередній id може прийти пізніше за нову
    let cancelled = false;
    // Кожен захід на сторінку починає новий відлік очікування
    deadlineRef.current = null;
    Api()
      .orders.findById(id)
      .then((data) => {
        if (!cancelled) {
          setLoaded({ id, order: toPaymentOrder(data) });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded({
            id,
            error: 'Не вдалося перевірити статус оплати. Спробуйте пізніше.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router.isReady, validId, id]);

  useEffect(() => {
    if (!order || !isAwaitingPayment(order)) return;

    const orderId = order.id;
    if (!deadlineRef.current || deadlineRef.current.id !== orderId) {
      deadlineRef.current = { id: orderId, at: Date.now() + POLL_TIMEOUT_MS };
    }
    const deadline = deadlineRef.current.at;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const markExpired = () =>
      setLoaded((prev) =>
        prev && prev.id === orderId ? { ...prev, expired: true } : prev
      );

    function schedule() {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        markExpired();
        return;
      }
      timer = setTimeout(check, Math.min(POLL_INTERVAL_MS, remaining));
    }

    async function check() {
      if (Date.now() >= deadline) {
        markExpired();
        return;
      }
      try {
        const data = await Api().orders.findById(orderId);
        if (cancelled) return;
        const next = toPaymentOrder(data);
        setLoaded({ id: orderId, order: next });
        if (isAwaitingPayment(next)) schedule();
      } catch {
        // Тимчасова помилка мережі не привід лякати покупця: пробуємо до дедлайну
        if (!cancelled) schedule();
      }
    }

    timer = setTimeout(check, Math.min(POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())));
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [order, id]);

  if (loading) {
    return (
      <MainLayout title='Оплата'>
        <Box sx={{ maxWidth: 500, mx: 'auto', px: 2, py: 6, textAlign: 'center' }}>
          <CircularProgress size={48} />
          <Typography variant="body1" sx={{ mt: 2, color: 'text.secondary' }}>
            Перевіряємо оплату…
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

  if (!order) {
    return null;
  }

  const isPaid = order.paymentStatus === PaymentStatus.Paid;
  const isFailed = order.paymentStatus === PaymentStatus.Failed;
  const isChecking = isAwaitingPayment(order) && !waitingExpired;

  if (isChecking) {
    return (
      <MainLayout title='Оплата'>
        <Box sx={{ maxWidth: 500, mx: 'auto', px: 2, py: 6, textAlign: 'center' }}>
          <CircularProgress size={48} />
          <Typography variant="body1" sx={{ mt: 2, color: 'text.secondary' }}>
            Перевіряємо оплату…
          </Typography>
        </Box>
      </MainLayout>
    );
  }

  // «Повторити оплату» — лише коли оплата точно не пройшла
  // або коли час очікування на вебхук минув, а не під час перевірки.
  const showRetry =
    cardPaymentAvailable &&
    order.status !== Status.Canceled &&
    isCardUnpaid(order.paymentMethod, order.paymentStatus, order.status) &&
    (isFailed || waitingExpired);

  const handleRetryPayment = async () => {
    try {
      const { pageUrl } = await Api().payment.createInvoice(order.id);
      window.location.href = pageUrl;
    } catch (e) {
      const message = e?.response?.data?.message;
      const details = String(Array.isArray(message) ? message.join('. ') : message || '')
        .trim()
        .replace(/\.$/, '');
      setLoaded((prev) =>
        prev && prev.id === id
          ? {
              ...prev,
              error:
                'Не вдалося перейти до оплати.' +
                (details ? ` ${details}.` : '') +
                ' Спробуйте пізніше.',
            }
          : prev
      );
    }
  };

  const statusLabel = getPaymentChipLabel(order.paymentMethod, order.paymentStatus, order.status);

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
              Ваше замовлення №{order.id} оплачено. Статус: <strong>Оплачено</strong>.
            </Typography>
          </>
        ) : (
          <>
            <Alert severity={isFailed ? 'error' : 'warning'} sx={{ mb: 3 }}>
              {isFailed ? 'Оплата не пройшла.' : 'Оплата ще не підтверджена.'} Статус: {statusLabel}.
            </Alert>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
              {isFailed
                ? 'Спробуйте ще раз або оберіть інший спосіб оплати.'
                : 'Якщо ви оплатили замовлення, статус оновиться протягом кількох хвилин.'}
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
