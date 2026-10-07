import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Link from 'next/link';
import { MainLayout } from '../layouts/MainLayout';
import { useAppSelector } from '../redux/hooks';
import { Role } from '../redux/Types/ProductType';
import { Api } from '../api/Api';
import { QuickOrder } from '../api/QuickOrderApi';
import { formatPhone } from '../utils/phone';

// Заявки «Замовити в 1 клік» для адміна: кому передзвонити і що людина хоче купити
export default function QuickOrdersPage() {
  const isAdmin = useAppSelector(
    state => state.user.userData?.roles.some(role => role.value === Role.admin) ?? false
  );
  const [quickOrders, setQuickOrders] = useState<QuickOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    Api()
      .quickOrder.findAll()
      .then(setQuickOrders)
      .catch(() => setError('Не вдалося завантажити заявки'));
  }, [isAdmin]);

  const remove = async (id: number) => {
    try {
      await Api().quickOrder.remove(id);
      setQuickOrders(orders => orders?.filter(order => order.id !== id) ?? null);
    } catch {
      setError('Не вдалося видалити заявку');
    }
  };

  const renderContent = () => {
    if (!isAdmin) {
      return <Alert severity='warning'>Сторінка доступна лише адміністратору</Alert>;
    }
    if (!quickOrders) {
      return error ? null : <CircularProgress sx={{ display: 'block', mx: 'auto' }} />;
    }
    if (quickOrders.length === 0) {
      return <Typography sx={{ color: 'text.secondary' }}>Нових заявок немає</Typography>;
    }
    return quickOrders.map(({ id, phoneNumber, product, size, createdAt }) => (
      <Box
        key={id}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          mb: 1.5,
          bgcolor: '#f2f4f4',
          borderRadius: 3,
        }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }}>
            <a href={`tel:+${phoneNumber}`}>{formatPhone(phoneNumber)}</a>
          </Typography>
          <Typography sx={{ fontSize: '0.85rem' }}>
            {product ? (
              <Link href={`/product/${product.id}`}>{product.name}</Link>
            ) : (
              'Товар видалено'
            )}
            {size && ` · розмір ${size}`}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            {new Date(createdAt).toLocaleString('uk-UA')}
          </Typography>
        </Box>
        <Button variant='outlined' size='small' onClick={() => remove(id)}>
          Опрацьовано
        </Button>
      </Box>
    ));
  };

  return (
    <MainLayout title='Заявки в 1 клік'>
      <Box sx={{ maxWidth: 700, mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 3, md: 6 } }}>
        <Typography variant='h4' sx={{ fontSize: '1.25rem', mb: 3 }}>
          Заявки «Замовити в 1 клік»
        </Typography>
        {error && (
          <Alert severity='error' sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {renderContent()}
      </Box>
    </MainLayout>
  );
}
