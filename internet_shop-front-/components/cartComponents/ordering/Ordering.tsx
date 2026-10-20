import { NextPage } from 'next';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { useEffect, useRef, useState } from 'react';
import { updateUserData } from '../../../redux/slices/auth-reducer';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import { Delivery } from './delivery/delivery';
import { UkrposhtaDelivery } from './delivery/UkrposhtaDelivery';
import { novaPoshtaDeliverySearch } from '../../../api/novaposhtaApi';
import { meestDeliverySearch } from '../../../api/meestApi';
import * as React from 'react';
import { Form, Formik } from 'formik';
import CustomizedInputBase from '../../CustomizedInputBase/CustomizedInputBase';
import { NewUserData } from './userData/NewUserData';
import { ValidateOrder } from './userData/ValidateOrder';
import LoadingButton from '@mui/lab/LoadingButton';
import { Api } from '../../../api/Api';
import { CreateOrderItemDto } from '../../../api/OrderApi';
import { useRouter } from 'next/dist/client/router';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import { cleanTheBasket } from '../../../redux/slices/cart-reducer';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { normalizePhone } from '../../../utils/phone';
import { DeliveryMethod } from '../../../redux/Types/orderType';
import { deliveryMethodLabels } from '../../../utils/delivery';
import { isUkrposhtaIndexValid } from './delivery/UkrposhtaDelivery';

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
    // Порівнюємо за нормалізованим номером: у полі він із маскою,
    // у профілі — у форматі бази
    const samePhone = normalizePhone(phoneNumber) === normalizePhone(newPhoneNumber);
    if (fullName === newFullName && samePhone) {
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
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(
    DeliveryMethod.NovaPoshta
  );
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'CARD'>('COD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const orderIdRef = useRef<number | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);

  // Зміна перевізника очищає місто й відділення: значення одного
  // перевізника не годяться для іншого (у Укрпошти в department — індекс)
  const changeDeliveryMethod = (method: DeliveryMethod) => {
    if (method === deliveryMethod) {
      return;
    }
    setDeliveryMethod(method);
    setCity('');
    setDepartment('');
  };

  // Доставка заповнена: для Нової пошти вибрано відділення,
  // для Укрпошти є населений пункт і правильний індекс
  const deliveryFilled =
    deliveryMethod === DeliveryMethod.Ukrposhta
      ? Boolean(cityName.trim()) && isUkrposhtaIndexValid(department)
      : Boolean(department);

  useEffect(() => {
    // StrictMode у dev імітує розмонтування й повторний монтаж, тож без цього
    // mountedRef лишається false і стан завантаження та помилки не показуються
    mountedRef.current = true;
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
        let redirecting = false;
        try {
          const saved = await checkUserData(values.fullName, values.phoneNumber);
          if (!saved?.success) {
            changeError(
              saved?.message ||
                'Не вдалося зберегти контактні дані. Спробуйте ще раз.'
            );
            return;
          }

          // Замовлення вже створене, але інвойс не вдався: повторюємо лише інвойс,
          // щоб не створити дубль і не списати склад удруге
          let orderId = orderIdRef.current;
          if (!orderId) {
            const order = await Api().orders.create({
              comment: values.comment,
              items,
              cityName: cityName.trim(),
              department,
              deliveryMethod,
              paymentMethod,
            });
            orderId = order.id;
            orderIdRef.current = orderId;
            if (mountedRef.current) {
              setCreatedOrderId(orderId);
            }
          }

          if (paymentMethod === 'COD') {
            await dispatch(cleanTheBasket(id));
            router.push('/orders');
            return;
          }

          try {
            const { pageUrl } = await Api().payment.createInvoice(orderId);
            // Кошик чистимо лише тепер: порожній кошик розмонтовує форму,
            // і на помилці інвойсу покупець не побачив би повідомлення
            await dispatch(cleanTheBasket(id));
            redirecting = true;
            window.location.href = pageUrl;
          } catch (e) {
            const message = e?.response?.data?.message;
            const details = String(Array.isArray(message) ? message.join('. ') : message || '')
              .trim()
              .replace(/\.$/, '');
            changeError(
              `Замовлення №${orderId} створено, але не вдалося перейти до оплати.` +
                (details ? ` ${details}.` : '') +
                ' Натисніть «Оформити замовлення», щоб спробувати ще раз.'
            );
          }
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
          // Під час переходу на сторінку mono кнопка лишається в стані завантаження
          if (!redirecting) {
            changeLoading(false);
          }
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
            {/* Після створення замовлення перевізника не змінюється,
                як і спосіб оплати: інакше повтор інвойсу розійдеться
                з уже створеним замовленням */}
            <FormControl component="fieldset" disabled={createdOrderId !== null}>
              <FormLabel component="legend">Оберіть перевізника</FormLabel>
              <RadioGroup
                value={deliveryMethod}
                onChange={(e) =>
                  changeDeliveryMethod(e.target.value as DeliveryMethod)
                }
                row
                sx={{ gap: 4, flexWrap: 'wrap' }}
              >
                <FormControlLabel
                  value={DeliveryMethod.NovaPoshta}
                  control={<Radio color="primary" />}
                  label={deliveryMethodLabels[DeliveryMethod.NovaPoshta]}
                  labelPlacement="end"
                />
                <FormControlLabel
                  value={DeliveryMethod.Ukrposhta}
                  control={<Radio color="primary" />}
                  label={deliveryMethodLabels[DeliveryMethod.Ukrposhta]}
                  labelPlacement="end"
                />
                <FormControlLabel
                  value={DeliveryMethod.Meest}
                  control={<Radio color="primary" />}
                  label={deliveryMethodLabels[DeliveryMethod.Meest]}
                  labelPlacement="end"
                />
              </RadioGroup>
            </FormControl>
            {deliveryMethod === DeliveryMethod.Ukrposhta ? (
              <UkrposhtaDelivery
                cityName={cityName}
                department={department}
                setCity={setCity}
                setDepartment={setDepartment}
              />
            ) : (
              <Delivery
                // key: зміна перевізника має скинути й внутрішній стан пошуку —
                // залишкові результати іншого перевізника не повинні показуватися
                key={deliveryMethod}
                search={
                  deliveryMethod === DeliveryMethod.Meest
                    ? meestDeliverySearch
                    : novaPoshtaDeliverySearch
                }
                cityName={cityName}
                department={department}
                setCity={setCity}
                setDepartment={setDepartment}
              />
            )}
          </Box>
        </Box>

        {/* Section 3: Payment method */}
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
            3. Спосіб оплати
          </Typography>
          <Box
            sx={{
              bgcolor: '#eceeee',
              borderRadius: 3,
              p: { xs: 2, md: 4 },
            }}
          >
            {/* Після створення замовлення спосіб оплати не змінюється,
                щоб повтор не створив друге замовлення */}
            <FormControl component="fieldset" disabled={createdOrderId !== null}>
              <FormLabel component="legend">Оберіть спосіб оплати</FormLabel>
              <RadioGroup
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'COD' | 'CARD')}
                row
                sx={{ gap: 4 }}
              >
                <FormControlLabel
                  value="COD"
                  control={<Radio color="primary" />}
                  label="При отриманні (готівка або картка кур'єру)"
                  labelPlacement="end"
                />
                <FormControlLabel
                  value="CARD"
                  control={<Radio color="primary" />}
                  label="Карткою онлайн (Mono)"
                  labelPlacement="end"
                />
              </RadioGroup>
            </FormControl>
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
          disabled={!deliveryFilled}
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
