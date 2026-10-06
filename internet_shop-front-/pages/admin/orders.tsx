import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Pagination from '@mui/material/Pagination';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { MainLayout } from '../../layouts/MainLayout';
import { useAppSelector } from '../../redux/hooks';
import { Role } from '../../redux/Types/ProductType';
import { Status } from '../../redux/Types/orderType';
import { Api } from '../../api/Api';
import { OrdersPage } from '../../api/OrderApi';
import { formatPhone } from '../../api/QuickOrderApi';
import { statusColor } from '../../components/MyOrders/MyOrders';

const LIMIT = 20;

// Усі замовлення магазину для адміна: нові першими, фільтр за статусом
export default function AdminOrdersPage() {
  const router = useRouter();
  const isAdmin = useAppSelector(
    state => state.user.userData?.roles.some(role => role.value === Role.admin) ?? false
  );
  const [status, setStatus] = useState<Status | null>(null);
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<OrdersPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    // Відповідь на попередній фільтр чи сторінку може прийти пізніше за нову
    let cancelled = false;
    setOrders(null);
    setError(null);
    Api()
      .orders.findAll({ page, limit: LIMIT, status: status ?? undefined })
      .then(result => !cancelled && setOrders(result))
      .catch(() => !cancelled && setError('Не вдалося завантажити замовлення'));
    return () => {
      cancelled = true;
    };
  }, [isAdmin, status, page]);

  const changeStatus = (value: Status | null) => {
    setStatus(value);
    setPage(1);
  };

  // Клік по рядку відкриває деталі замовлення
  const openOrder = (id: number) => router.push(`/admin/orders/${id}`);

  const renderOrders = () => {
    if (!orders) {
      return error ? null : <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />;
    }
    if (orders.data.length === 0) {
      return <Typography sx={{ color: 'text.secondary' }}>Замовлень немає</Typography>;
    }
    const pageCount = Math.ceil(orders.total / orders.limit);
    return (
      <>
        <TableContainer>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>№</TableCell>
                <TableCell>Дата</TableCell>
                <TableCell>Покупець</TableCell>
                <TableCell>Телефон</TableCell>
                <TableCell align='right'>Сума</TableCell>
                <TableCell>Статус</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.data.map(({ id, createdAt, user, total, status }) => (
                <TableRow
                  key={id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => openOrder(id)}
                >
                  <TableCell>
                    <Link href={`/admin/orders/${id}`}>
                      <a
                        style={{ color: 'inherit' }}
                        onClick={event => event.stopPropagation()}
                      >
                        {id}
                      </a>
                    </Link>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {new Date(createdAt).toLocaleString('uk-UA', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </TableCell>
                  <TableCell>{user?.fullName ?? 'Користувача видалено'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {user && <a href={`tel:+${user.phoneNumber}`}>{formatPhone(user.phoneNumber)}</a>}
                  </TableCell>
                  <TableCell align='right' sx={{ whiteSpace: 'nowrap' }}>
                    {total} грн
                  </TableCell>
                  <TableCell>
                    <Chip label={status} color={statusColor[status]} size='small' />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {pageCount > 1 && (
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_, value) => setPage(value)}
            sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}
          />
        )}
      </>
    );
  };

  return (
    <MainLayout title='Замовлення'>
      <Box sx={{ maxWidth: 1000, mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 3, md: 6 } }}>
        <Typography variant='h4' sx={{ fontSize: '1.25rem', mb: 3 }}>
          Замовлення
        </Typography>
        {!isAdmin ? (
          <Alert severity='warning'>Сторінка доступна лише адміністратору</Alert>
        ) : (
          <>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
              <Chip
                label='Усі'
                color={status === null ? 'primary' : 'default'}
                onClick={() => changeStatus(null)}
              />
              {Object.values(Status).map(value => (
                <Chip
                  key={value}
                  label={value}
                  color={status === value ? 'primary' : 'default'}
                  onClick={() => changeStatus(value)}
                />
              ))}
            </Box>
            {orders && (
              <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 1 }}>
                Знайдено: {orders.total}
              </Typography>
            )}
            {error && (
              <Alert severity='error' sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {renderOrders()}
          </>
        )}
      </Box>
    </MainLayout>
  );
}
