import { NextPage } from 'next';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { useState } from 'react';
import { updateUserData } from '../../../redux/slices/auth-reducer';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { Delivery } from './delivery/delivery';
import * as React from 'react';
import { Form, Formik } from 'formik';
import CustomizedInputBase from '../../CustomizedInputBase/CustomizedInputBase';
import { NewUserData } from './userData/NewUserData';
import { ValidateOrder } from './userData/ValidateOrder';
import LoadingButton from '@mui/lab/LoadingButton';
import { Api } from '../../../api/Api';
import { useRouter } from 'next/dist/client/router';
import { cleanTheBasket } from '../../../redux/slices/cart-reducer';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

interface OrderingComponentProps {
  productIdArr: number[];
}

const OrderingComponent: NextPage<OrderingComponentProps> = ({ productIdArr }) => {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const userData = useAppSelector((store) => store.user.userData);
  const fullName = userData?.fullName || '';
  const phoneNumber = userData?.phoneNumber || '';
  const id = userData?.id;

  const checkUserData = (newFullName, newPhoneNumber) => {
    if (fullName !== newFullName || phoneNumber !== newPhoneNumber) {
      dispatch(
        updateUserData(id, {
          fullName: newFullName,
          phoneNumber: newPhoneNumber,
        })
      );
    }
  };

  const [cityName, setCity] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <Formik
      initialValues={{
        fullName: fullName,
        phoneNumber: phoneNumber,
        comment: '',
      }}
      validationSchema={ValidateOrder}
      onSubmit={async (values) => {
        try {
          setLoading(true);
          await checkUserData(values.fullName, values.phoneNumber);
          await Api().orders.create({
            comment: values.comment,
            productId: productIdArr,
            cityName,
            department,
            userId: id,
          });
          await dispatch(cleanTheBasket(id));
          router.push('/orders');
        } catch (e) {
          alert(e);
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
