import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import { MainLayout } from '../../../layouts/MainLayout';
import { useAppSelector } from '../../../redux/hooks';
import { Role } from '../../../redux/Types/ProductType';
import { Order, Status, PaymentMethod, PaymentStatus } from '../../../redux/Types/orderType';
import { Api } from '../../../api/Api';
import { OrderPaymentDetails, PaymentHistoryKind } from '../../../api/PaymentApi';
import { formatPhone } from '../../../utils/phone';
import { formatDelivery } from '../../../utils/delivery';
import {
  statusColor,
  getPaymentChipLabel,
  getPaymentChipColor,
  paymentStatusLabel,
} from '../../../components/MyOrders/MyOrders';

const sectionSx = {
  border: '1px solid',
  borderColor: 'rgba(175, 179, 179, 0.3)',
  borderRadius: 3,
  p: { xs: 2, md: 3 },
  mb: 2,
};

// Бекенд у відповідях на помилки віддає текст у полі message
const readApiError = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: { message?: string } } })?.response?.data;
  const text = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
  return text || fallback;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString('uk-UA', { dateStyle: 'long', timeStyle: 'short' });

// У базі суми в копійках, у магазині показуємо гривні
const formatMoney = (kopeks: number) =>
  `${(kopeks / 100).toLocaleString('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} грн`;

const parseRefundKopeks = (value: string): number | null => {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const hryvnias = Number(normalized);
  if (!Number.isFinite(hryvnias) || hryvnias <= 0) return null;
  const kopeks = Math.round(hryvnias * 100);
  return kopeks > 0 ? kopeks : null;
};

const paymentEventLabel: Record<PaymentHistoryKind, string> = {
  invoice: 'Рахунок створено',
  webhook: 'Сповіщення mono',
  status: 'Звірка статусу',
};

const paymentStatusLabelFor = (status: string) =>
  paymentStatusLabel[status as PaymentStatus] ?? status;

// Деталі замовлення для адміна: позиції, покупець, доставка і зміна статусу
export default function AdminOrderDetailsPage() {
  const router = useRouter();
  const isAdmin = useAppSelector(
    state => state.user.userData?.roles.some(role => role.value === Role.admin) ?? false
  );
  const rawId = router.query.id;
  const id = typeof rawId === 'string' ? Number(rawId) : NaN;
  const validId = Number.isInteger(id) && id >= 1;

  // Результат прив'язаний до id, тож при зміні id старе замовлення не показуємо
  const [loaded, setLoaded] = useState<{ id: number; order?: Order; error?: string } | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(
    null
  );
  // Деталі оплати вантажимо окремо: вони потрібні лише для замовлень карткою
  const [paymentLoaded, setPaymentLoaded] = useState<{
    id: number;
    data?: OrderPaymentDetails;
    error?: string;
  } | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundMode, setRefundMode] = useState<'full' | 'partial'>('full');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundConfirming, setRefundConfirming] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || !router.isReady || !validId) return;
    // Відповідь на попередній id може прийти пізніше за нову
    let cancelled = false;
    Api()
      .orders.findById(id)
      .then(data => {
        if (cancelled) return;
        setLoaded({ id, order: data });
        setStatus(data.status);
      })
      .catch(
        err =>
          !cancelled &&
          setLoaded({ id, error: readApiError(err, 'Не вдалося завантажити замовлення') })
      );
    return () => {
      cancelled = true;
    };
  }, [isAdmin, router.isReady, validId, id]);

  const current = loaded?.id === id ? loaded : null;
  const order = current?.order ?? null;
  const error = !router.isReady
    ? null
    : validId
    ? current?.error ?? null
    : 'Не знайдено такого замовлення';

  const orderId = order?.id;
  const isCardPayment = order?.paymentMethod === PaymentMethod.Card;

  useEffect(() => {
    if (!isAdmin || !orderId || !isCardPayment) return;
    let cancelled = false;
    Api()
      .payment.getOrderPayment(orderId)
      .then(data => {
        if (!cancelled) setPaymentLoaded({ id: orderId, data });
      })
      .catch(
        err =>
          !cancelled &&
          setPaymentLoaded({
            id: orderId,
            error: readApiError(err, 'Не вдалося завантажити дані оплати'),
          })
      );
    return () => {
      cancelled = true;
    };
  }, [isAdmin, orderId, isCardPayment]);

  const saveStatus = async () => {
    if (!order || !status || status === order.status || saving) return;
    setSaving(true);
    try {
      const updated = await Api().orders.updateStatus(order.id, status);
      // У відповіді PATCH лише саме замовлення, позиції й покупець — з поточного стану
      setLoaded(prev =>
        prev?.order ? { ...prev, order: { ...prev.order, status: updated.status } } : prev
      );
      setMessage({ severity: 'success', text: 'Статус замовлення оновлено' });
    } catch (err) {
      setMessage({ severity: 'error', text: readApiError(err, 'Не вдалося оновити статус') });
    } finally {
      setSaving(false);
    }
  };

  const renderPayment = () => {
    if (!orderId) return null;
    if (paymentLoaded?.id !== orderId) {
      return <CircularProgress size={24} />;
    }
    if (paymentLoaded.error) {
      return <Alert severity='error'>{paymentLoaded.error}</Alert>;
    }

    const payment = paymentLoaded.data;
    if (!payment) return null;

    const reloadOrderAndPayment = async () => {
      const [data, paymentData] = await Promise.all([
        Api().orders.findById(orderId),
        Api().payment.getOrderPayment(orderId),
      ]);
      setLoaded({ id: orderId, order: data });
      setStatus(data.status);
      setPaymentLoaded({ id: orderId, data: paymentData });
    };

    const closeRefund = () => {
      if (refunding) return;
      setRefundOpen(false);
      setRefundConfirming(false);
      setRefundError(null);
    };

    const openRefund = () => {
      setRefundMode('full');
      setRefundAmount('');
      setRefundConfirming(false);
      setRefundError(null);
      setRefundOpen(true);
    };

    const partialKopeks = refundMode === 'partial' ? parseRefundKopeks(refundAmount) : null;
    const refundKopeks = refundMode === 'full' ? payment.refundableAmount : partialKopeks;
    const partialAmountError =
      refundMode === 'partial' && !refundConfirming
        ? refundAmount.trim() === ''
          ? 'Вкажіть суму'
          : partialKopeks === null || partialKopeks > payment.refundableAmount
          ? `Сума має бути більшою за нуль і не більшою за ${formatMoney(
              payment.refundableAmount
            )}`
          : null
        : null;
    const canRefund =
      order.paymentStatus === PaymentStatus.Paid &&
      payment.invoiceId !== null &&
      payment.refundableAmount > 0;

    const submitRefund = async () => {
      if (!payment.invoiceId || refundKopeks === null || refunding) return;
      setRefunding(true);
      setRefundError(null);
      try {
        await Api()
          .payment.refund(
            payment.invoiceId,
            refundMode === 'partial' ? refundKopeks : undefined
          );
      } catch (err) {
        setRefundError(readApiError(err, 'Не вдалося повернути кошти'));
        setRefunding(false);
        return;
      }

      setRefundOpen(false);
      setRefundConfirming(false);
      setMessage({ severity: 'success', text: `Повернено ${formatMoney(refundKopeks)}` });
      try {
        await reloadOrderAndPayment();
      } catch (err) {
        setMessage({
          severity: 'error',
          text: readApiError(err, 'Кошти повернено, але не вдалося оновити дані замовлення'),
        });
      }
      setRefunding(false);
    };

    const field = (label: string, value: string) => (
      <Box>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, wordBreak: 'break-word' }}>
          {value}
        </Typography>
      </Box>
    );

    return (
      <>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.5,
            mb: 2,
          }}
        >
          {field('Рахунок mono', payment.invoiceId ?? 'ще не створено')}
          {field('Час оплати', payment.paidAt ? formatDate(payment.paidAt) : '—')}
          {field('Сума оплати', payment.amount === null ? '—' : formatMoney(payment.amount))}
          {field('Повернено', formatMoney(payment.refundedAmount))}
          {field('Залишок до повернення', formatMoney(payment.refundableAmount))}
        </Box>

        {canRefund && (
          <Box sx={{ mb: 2 }}>
            <Button variant='outlined' color='error' onClick={openRefund}>
              Повернути кошти
            </Button>
          </Box>
        )}

        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 1 }}>Історія оплати</Typography>
        {payment.history.length === 0 ? (
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
            Подій оплати ще немає
          </Typography>
        ) : (
          <TableContainer>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Час</TableCell>
                  <TableCell>Подія</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell align='right'>Сума</TableCell>
                  <TableCell>Причина відмови</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payment.history.map((entry, index) => (
                  <TableRow key={`${entry.at}-${index}`}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(entry.at)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {paymentEventLabel[entry.kind] ?? entry.kind}
                    </TableCell>
                    <TableCell>
                      {paymentStatusLabelFor(entry.status)}
                      {entry.monoStatus && (
                        <Typography
                          component='span'
                          sx={{ display: 'block', fontSize: '0.75rem', color: 'text.secondary' }}
                        >
                          mono: {entry.monoStatus}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align='right' sx={{ whiteSpace: 'nowrap' }}>
                      {formatMoney(entry.amount)}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.85rem' }}>{entry.failureReason ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Dialog
          open={refundOpen}
          onClose={closeRefund}
          maxWidth='xs'
          fullWidth
          disableEscapeKeyDown={refunding}
        >
          <DialogTitle>
            {refundConfirming ? 'Підтвердіть повернення' : 'Повернення коштів'}
          </DialogTitle>
          <DialogContent>
            {refundError && (
              <Alert severity='error' sx={{ mb: 2 }}>
                {refundError}
              </Alert>
            )}
            {refundConfirming ? (
              <Typography sx={{ fontSize: '0.9rem' }}>
                Повернути {refundKopeks === null ? '' : formatMoney(refundKopeks)} за рахунком{' '}
                {payment.invoiceId}? Кошти надійдуть покупцю, скасувати дію не можна.
              </Typography>
            ) : (
              <>
                <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary', mb: 1.5 }}>
                  Залишок до повернення: {formatMoney(payment.refundableAmount)}
                </Typography>
                <RadioGroup
                  value={refundMode}
                  onChange={event => {
                    setRefundMode(event.target.value as 'full' | 'partial');
                    setRefundError(null);
                  }}
                >
                  <FormControlLabel
                    value='full'
                    control={<Radio />}
                    label={`Усю суму (${formatMoney(payment.refundableAmount)})`}
                  />
                  <FormControlLabel value='partial' control={<Radio />} label='Частину' />
                </RadioGroup>
                {refundMode === 'partial' && (
                  <TextField
                    label='Сума, грн'
                    value={refundAmount}
                    onChange={event => {
                      setRefundAmount(event.target.value);
                      setRefundError(null);
                    }}
                    error={Boolean(partialAmountError)}
                    helperText={partialAmountError ?? ' '}
                    inputProps={{ inputMode: 'decimal' }}
                    size='small'
                    fullWidth
                    sx={{ mt: 1 }}
                  />
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            {refundConfirming ? (
              <>
                <Button onClick={() => setRefundConfirming(false)} disabled={refunding}>
                  Назад
                </Button>
                <Button
                  variant='contained'
                  color='error'
                  onClick={submitRefund}
                  disabled={refunding}
                >
                  {refunding ? 'Повертаємо…' : 'Підтвердити'}
                </Button>
              </>
            ) : (
              <>
                <Button onClick={closeRefund}>Скасувати</Button>
                <Button
                  variant='contained'
                  onClick={() => setRefundConfirming(true)}
                  disabled={refundMode === 'partial' && Boolean(partialAmountError)}
                >
                  Далі
                </Button>
              </>
            )}
          </DialogActions>
        </Dialog>
      </>
    );
  };

  const renderDetails = () => {
    if (!order) {
      return error ? (
        <>
          <Alert severity='error' sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Link href='/admin/orders' style={{ color: 'inherit' }}>← До списку замовлень</Link>
        </>
      ) : (
        <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />
      );
    }

    return (
      <>
        <Box sx={{ ...sectionSx }}>
          <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Позиції</Typography>
          <TableContainer>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Товар</TableCell>
                  <TableCell>Розмір</TableCell>
                  <TableCell align='right'>Кількість</TableCell>
                  <TableCell align='right'>Ціна</TableCell>
                  <TableCell align='right'>Сума</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {order.items.map(({ id: itemId, product, size, quantity, price }) => (
                  <TableRow key={itemId}>
                    <TableCell>
                      <Link href={`/product/${product.id}`} style={{ color: 'inherit' }}>{product.name}</Link>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{size}</TableCell>
                    <TableCell align='right' sx={{ whiteSpace: 'nowrap' }}>
                      {quantity} шт.
                    </TableCell>
                    <TableCell align='right' sx={{ whiteSpace: 'nowrap' }}>
                      {price} грн
                    </TableCell>
                    <TableCell align='right' sx={{ whiteSpace: 'nowrap' }}>
                      {price * quantity} грн
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} align='right' sx={{ fontWeight: 700 }}>
                    Разом
                  </TableCell>
                  <TableCell align='right' sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {order.total} грн
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        <Box sx={{ ...sectionSx }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Покупець</Typography>
          {order.user ? (
            <>
              <Typography sx={{ fontSize: '0.9rem' }}>{order.user.fullName}</Typography>
              <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                <a href={`tel:+${order.user.phoneNumber}`}>{formatPhone(order.user.phoneNumber)}</a>
              </Typography>
            </>
          ) : (
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
              Користувача видалено
            </Typography>
          )}
        </Box>

        <Box sx={{ ...sectionSx }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Доставка</Typography>
          <Typography sx={{ fontSize: '0.9rem' }}>
            {formatDelivery(order)}
          </Typography>
          {order.comment && (
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
              Коментар: {order.comment}
            </Typography>
          )}
        </Box>

        {order.paymentMethod === PaymentMethod.Card && (
          <Box sx={{ ...sectionSx }}>
            <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Оплата</Typography>
            {renderPayment()}
          </Box>
        )}

        <Box sx={{ ...sectionSx }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 700 }}>Статус виконання</Typography>
            <Chip label={order.status} color={statusColor[order.status]} size='small' />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 700 }}>Статус оплати</Typography>
            <Chip
              label={getPaymentChipLabel(order.paymentMethod, order.paymentStatus, order.status)}
              color={getPaymentChipColor(order.paymentMethod, order.paymentStatus, order.status)}
              size='small'
            />
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
            <Select
              value={status ?? order.status}
              onChange={event => setStatus(event.target.value as Status)}
              size='small'
              sx={{ minWidth: 200 }}
              inputProps={{ 'aria-label': 'Новий статус замовлення' }}
            >
              {Object.values(Status).map(value => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </Select>
            <Button
              variant='contained'
              disabled={saving || status === order.status}
              onClick={saveStatus}
            >
              {saving ? 'Зберігаємо…' : 'Зберегти статус'}
            </Button>
          </Box>
        </Box>
      </>
    );
  };

  return (
    <MainLayout title={`Замовлення №${id || ''}`}>
      <Box sx={{ maxWidth: 1000, mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 3, md: 6 } }}>
        <Link href='/admin/orders' style={{ color: 'inherit', textDecoration: 'none' }}>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 1 }}>
            ← До списку замовлень
          </Typography>
        </Link>
        <Typography variant='h4' sx={{ fontSize: '1.25rem', mb: 3 }}>
          Замовлення №{id || ''}
        </Typography>
        {!isAdmin ? (
          <Alert severity='warning'>Сторінка доступна лише адміністратору</Alert>
        ) : (
          <>
            {order && (
              <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 2 }}>
                Оформлено {formatDate(order.createdAt)}
              </Typography>
            )}
            {renderDetails()}
          </>
        )}
        <Snackbar
          open={message !== null}
          autoHideDuration={3000}
          onClose={() => setMessage(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setMessage(null)}
            severity={message?.severity}
            sx={{ width: '100%' }}
          >
            {message?.text}
          </Alert>
        </Snackbar>
      </Box>
    </MainLayout>
  );
}
