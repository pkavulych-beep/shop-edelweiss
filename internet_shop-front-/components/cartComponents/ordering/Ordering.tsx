import { NextPage } from 'next';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { useEffect, useRef, useState } from 'react';
import { updateUserData } from '../../../redux/slices/auth-reducer';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import { Delivery } from './delivery/delivery';
import * as React from 'react';
import { Form, Formik } from 'formik';
import CustomizedInputBase from '../../CustomizedInputBase/CustomizedInputBase';
import { NewUserData } from './userData/NewUserData';
import { ValidateOrder } from './userData/ValidateOrder';
import LoadingButton from '@mui/lab/LoadingButton';
import { Api } from '../../../api/Api';
import { CreateOrderItemDto } from '../../../api/OrderApi';
import { useRouter } from 'next/dist/client/router';
import { cleanTheBasket } from '../../../redux/slices/cart-reducer';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

interface OrderingComponentProps {
  items: CreateOrderItemDto[];
}

const OrderingComponent: NextPage<OrderingComponentProps> = ({ items }) => {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const userData = useAppSelector((store) => store.user.userData);
  const fullName = userData?.fullName || '';
  const phoneNumber = userData?.phoneNumber || '';
  const id = userData?.id;

  const checkUserData = async (newFullName, newPhoneNumber) => {
    if (fullName === newFullName && phoneNumber === newPhoneNumber) {
      return { success: true };
    }
    return dispatch(
      updateUserData(id, {
        fullName: newFullName,
        phoneNumber: newPhoneNumber,
      })
    );
  };

  const [cityName, setCity] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const changeLoading = (value: boolean) => {
    if (mountedRef.current) {
      setLoading(value);
    }
  };

  const changeError = (value: string | null) => {
    if (mountedRef.current) {
      setError(value);
    }
  };

  return (
    <Formik
      initialValues={{
        fullName: fullName,
        phoneNumber: phoneNumber,
        comment: '',
      }}
      validationSchema={ValidateOrder}
      onSubmit={async (values) => {
        changeLoading(true);
        changeError(null);
        try {
          const saved = await checkUserData(values.fullName, values.phoneNumber);
          if (!saved?.success) {
            changeError(
              saved?.message ||
                'Не вдалося зберегти контактні дані. Спробуйте ще раз.'
            );
            return;
          }
          await Api().orders.create({
            comment: values.comment,
            items,
            cityName,
            department,
          });
          await dispatch(cleanTheBasket(id));
          router.push('/orders');
        } catch (e) {
          const message = e?.response?.data?.message;
          if (e?.response?.status === 401) {
            changeError('Сесія завершилась. Увійдіть ще раз, щоб оформити замовлення.');
          } else {
            changeError(
              (Array.isArray(message) ? message.join('. ') : message) ||
                'Не вдалося оформити замовлення. Спробуйте ще раз.'
            );
          }
        } finally {
          changeLoading(false);
        }
      }}
    >
      <Form>
        {/* Section 1: Contact */}
        <Box sx={{ mb: 6 }}>
          <Typography
            variant="h5"
            sx={{
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: 'primary.main',
              mb: 3,
            }}
          >
            1. Контактні дані
          </Typography>
          <NewUserData />
        </Box>

        {/* Section 2: Delivery */}
        <Box sx={{ mb: 6 }}>
          <Typography
            variant="h5"
            sx={{
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 3,
            }}
          >
            2. Доставка
          </Typography>
          <Box
            sx={{
              bgcolor: '#eceeee',
              borderRadius: 3,
              p: { xs: 2, md: 4 },
            }}
          >
            <Delivery
              cityName={cityName}
              department={department}
              setCity={setCity}
              setDepartment={setDepartment}
            />
          </Box>
        </Box>

        {/* Comment */}
        <Box sx={{ mb: 4 }}>
          <CustomizedInputBase
            type="string"
            name="comment"
            placeholder="Коментар до замовлення"
          />
        </Box>

        {/* Submit */}
        <LoadingButton
          loading={loading}
          disabled={!department}
          type="submit"
          variant="contained"
          fullWidth
          sx={{
            py: 2,
            borderRadius: 2,
            fontSize: '0.85rem',
          }}
        >
          Оформити замовлення
        </LoadingButton>

        {error && (
          <Alert severity="error" sx={{ mt: 2, fontSize: '0.85rem' }}>
            {error}
          </Alert>
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            mt: 2,
          }}
        >
          <LockOutlinedIcon sx={{ fontSize: 14, color: '#777b7c' }} />
          <Typography
            sx={{
              fontSize: '0.65rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: '#777b7c',
            }}
          >
            Безпечна оплата
          </Typography>
        </Box>
      </Form>
    </Formik>
  );
};

export const Ordering = React.memo(OrderingComponent);
