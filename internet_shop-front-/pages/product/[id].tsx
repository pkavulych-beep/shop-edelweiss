import { wrapper } from '../../redux/redux-store';
import { fetchProduct } from '../../redux/slices/product-reducer';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ProductInfo from '../../components/product/ProductInfo/ProductInfo';
import { MainLayout } from '../../layouts/MainLayout';
import { Pictures } from '../../components/product/pictures/Pictures';
import { PriceBox } from '../../components/PriceBox/PriceBox';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { addPositionsToCart } from '../../redux/slices/cart-reducer';
import { useState } from 'react';
import { useRouter } from 'next/router';
import css from '../../styles/Product.module.scss';
import Popup from '../../components/Popup';
import { Api } from '../../api/Api';
import { normalizePhone } from '../../api/QuickOrderApi';

export default function Product() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { currentProduct, userPhone } = useAppSelector(({ product, user, cart }) => ({
    ...product,
    idUser: user.userData?.id,
    userPhone: user.userData?.phoneNumber,
    ...cart,
  }));

  const [selectedSize, setSelectedSize] = useState<null | string>(null);
  const [isOpenSizeReminder, setIsOpenSizeReminder] = useState(false);
  const [isCartConfirmOpen, setIsCartConfirmOpen] = useState(false);
  const [isQuickOrderOpen, setIsQuickOrderOpen] = useState(false);
  const [quickOrderPhone, setQuickOrderPhone] = useState('');
  const [quickOrderError, setQuickOrderError] = useState<string | null>(null);
  const [isQuickOrderSending, setIsQuickOrderSending] = useState(false);
  const [isQuickOrderDone, setIsQuickOrderDone] = useState(false);

  if (!currentProduct || !currentProduct.photos) {
    return (
      <MainLayout title="Товар не знайдено">
        <Box sx={{ textAlign: 'center', py: 10 }}>
          <Typography variant="h4" sx={{ fontSize: '1.25rem', color: 'text.secondary', mb: 3 }}>
            Товар не знайдено
          </Typography>
          <Button variant="contained" onClick={() => router.push('/')}>
            На головну
          </Button>
        </Box>
      </MainLayout>
    );
  }

  const { cover, photos, ...productInfo } = currentProduct;
  const photosArr = [{ id: 0, url: cover }, ...photos];

  const putInTheCart = () => {
    if (!selectedSize) {
      setIsOpenSizeReminder(true);
      return;
    }

    dispatch(addPositionsToCart({ idProduct: currentProduct.id, size: selectedSize }));
    setIsCartConfirmOpen(true);
  };

  const openQuickOrder = () => {
    if (!selectedSize) {
      setIsOpenSizeReminder(true);
      return;
    }
    if (!quickOrderPhone && userPhone) {
      setQuickOrderPhone(userPhone);
    }
    setQuickOrderError(null);
    setIsQuickOrderOpen(true);
  };

  const sendQuickOrder = async () => {
    const phoneNumber = normalizePhone(quickOrderPhone);
    if (!phoneNumber) {
      setQuickOrderError('Вкажіть номер у форматі +38 (0XX) XXX-XX-XX');
      return;
    }

    setIsQuickOrderSending(true);
    setQuickOrderError(null);
    try {
      await Api().quickOrder.create({
        phoneNumber,
        productId: currentProduct.id,
        size: selectedSize ?? undefined,
      });
      setIsQuickOrderOpen(false);
      setIsQuickOrderDone(true);
    } catch (e) {
      const message = e.response?.data?.message;
      setQuickOrderError(
        (Array.isArray(message) ? message[0] : message) ||
          'Не вдалося надіслати заявку. Спробуйте ще раз'
      );
    } finally {
      setIsQuickOrderSending(false);
    }
  };

  return (
    <MainLayout title={productInfo.name}>
      <Box
        sx={{
          maxWidth: 1200,
          mx: 'auto',
          px: { xs: 2, md: 6 },
          py: { xs: 2, md: 4 },
        }}
      >
        <div className={css.root}>
          <Pictures photosArr={photosArr} />
          <ProductInfo
            {...productInfo}
            selectedSize={selectedSize}
            setSelectedSize={setSelectedSize}
          />
        </div>

        {/* Action buttons */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.5,
            my: 4,
            maxWidth: { xs: '100%', md: 400 },
            mx: 'auto',
          }}
        >
          <Button
            onClick={putInTheCart}
            variant="contained"
            fullWidth
            sx={{ py: 1.5 }}
          >
            Додати в кошик
          </Button>
          <Button
            onClick={openQuickOrder}
            variant="text"
            fullWidth
            sx={{
              py: 1,
              fontSize: '0.8rem',
              color: 'text.secondary',
              letterSpacing: '0.1em',
              '&:hover': { color: 'primary.main' },
            }}
          >
            Замовити в 1 клік
          </Button>
        </Box>

        {/* Description accordion */}
        <Box sx={{ maxWidth: 700, mx: 'auto', mb: 4 }}>
          <Accordion
            defaultExpanded
            disableGutters
            elevation={0}
            sx={{
              bgcolor: 'transparent',
              '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                }}
              >
                Опис товару
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
                {currentProduct.description}
              </Typography>
            </AccordionDetails>
          </Accordion>
        </Box>
      </Box>

      {/* Size reminder popup */}
      <Popup
        open={isOpenSizeReminder}
        onClose={() => setIsOpenSizeReminder(false)}
        title="Оберіть розмір"
        description="Спочатку необхідно обрати розмір товару"
      />

      {/* Cart confirmation popup */}
      <Popup
        open={isCartConfirmOpen}
        onClose={() => setIsCartConfirmOpen(false)}
        title=""
      >
        {/* Success icon */}
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: '#f9d461',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3,
          }}
        >
          <CheckCircleOutlineIcon sx={{ fontSize: 36, color: '#5c4900' }} />
        </Box>

        <Typography
          variant="h4"
          sx={{ fontSize: '1.15rem', textAlign: 'center', mb: 3, letterSpacing: '0.05em' }}
        >
          Товар додано в кошик
        </Typography>

        {/* Product summary card */}
        <Box
          sx={{
            width: '100%',
            bgcolor: '#f2f4f4',
            borderRadius: 3,
            p: 2,
            display: 'flex',
            gap: 2,
            mb: 4,
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 96,
              flexShrink: 0,
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: '#e6e9e9',
            }}
          >
            <img
              src={cover}
              alt={productInfo.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '0.8125rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                lineHeight: 1.3,
                mb: 0.5,
              }}
            >
              {productInfo.name}
            </Typography>
            <Box
              sx={{
                display: 'inline-flex',
                bgcolor: '#eceeee',
                borderRadius: 1,
                px: 1,
                py: 0.3,
                width: 'fit-content',
              }}
            >
              <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontWeight: 500 }}>
                Розмір: {selectedSize}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* CTA buttons */}
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={() => router.push('/cart')}
            sx={{ py: 1.5, borderRadius: 3 }}
          >
            Перейти в кошик
          </Button>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => setIsCartConfirmOpen(false)}
            sx={{ py: 1.5, borderRadius: 3 }}
          >
            Продовжити покупки
          </Button>
        </Box>
      </Popup>

      {/* Quick order modal */}
      <Popup
        open={isQuickOrderOpen}
        onClose={() => setIsQuickOrderOpen(false)}
        title="Замовити в 1 клік"
      >
        {/* Product summary */}
        <Box
          sx={{
            width: '100%',
            bgcolor: '#f2f4f4',
            borderRadius: 3,
            p: 2,
            display: 'flex',
            gap: 2,
            mb: 3,
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 96,
              flexShrink: 0,
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: '#e6e9e9',
            }}
          >
            <img
              src={cover}
              alt={productInfo.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '0.8125rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                lineHeight: 1.3,
                mb: 0.5,
              }}
            >
              {productInfo.name}
            </Typography>
            <PriceBox price={productInfo.price} salePrice={productInfo.salePrice} />
            {selectedSize && (
              <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 0.5 }}>
                Розмір: {selectedSize}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Phone input */}
        <Box sx={{ width: '100%', mb: 1 }}>
          <Typography
            sx={{
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              mb: 1,
            }}
          >
            Номер телефону
          </Typography>
          <TextField
            fullWidth
            placeholder="+38 (0__) ___-__-__"
            type="tel"
            inputProps={{ 'aria-label': 'Номер телефону' }}
            value={quickOrderPhone}
            onChange={(e) => {
              setQuickOrderPhone(e.target.value);
              setQuickOrderError(null);
            }}
            error={Boolean(quickOrderError)}
            helperText={quickOrderError}
            size="small"
          />
          <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mt: 1, lineHeight: 1.5 }}>
            Наш менеджер зателефонує вам для уточнення деталей та оформлення замовлення
          </Typography>
        </Box>

        <Button
          variant="contained"
          fullWidth
          endIcon={
            isQuickOrderSending ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              <ArrowForwardIcon />
            )
          }
          disabled={isQuickOrderSending}
          onClick={sendQuickOrder}
          sx={{ py: 1.5, borderRadius: 3, mt: 2 }}
        >
          Замовити
        </Button>
      </Popup>

      {/* Quick order confirmation popup */}
      <Popup
        open={isQuickOrderDone}
        onClose={() => setIsQuickOrderDone(false)}
        title="Заявку прийнято"
        description="Наш менеджер зателефонує вам найближчим часом, щоб уточнити деталі та оформити замовлення"
      />
    </MainLayout>
  );
}

export const getServerSideProps = wrapper.getServerSideProps(store =>
  // @ts-ignore
  async ({ params: { id: idProduct } }) => {
    // @ts-ignore
    await store.dispatch(fetchProduct(idProduct));
  }
);
