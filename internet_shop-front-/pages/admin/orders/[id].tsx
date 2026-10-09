import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { MainLayout } from '../../../layouts/MainLayout';
import { useAppSelector } from '../../../redux/hooks';
import { Role } from '../../../redux/Types/ProductType';
import { Order, Status } from '../../../redux/Types/orderType';
import { Api } from '../../../api/Api';
import { formatPhone } from '../../../utils/phone';
import { statusColor } from '../../../components/MyOrders/MyOrders';

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
            Нова пошта, {order.cityName}, {order.department}
          </Typography>
          {order.comment && (
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
              Коментар: {order.comment}
            </Typography>
          )}
        </Box>

        <Box sx={{ ...sectionSx }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Typography sx={{ fontWeight: 700 }}>Статус</Typography>
            <Chip label={order.status} color={statusColor[order.status]} size='small' />
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
