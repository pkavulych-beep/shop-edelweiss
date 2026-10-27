import { FC, useState } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { PriceBox } from '../../PriceBox/PriceBox';
import * as React from 'react';
import Link from 'next/link';
import {
  changeCartItemQuantity,
  pickUpFromTheCart,
} from '../../../redux/slices/cart-reducer';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';

export interface IPositionProps {
  id: number;
  cover: string;
  coverThumb?: string | null;
  name: string;
  size: string;
  price: number;
  salePrice: number;
  quantity: number;
  // Залишок обраного розміру; null — залишок не ведеться (без обмеження)
  available?: number | null;
  // Товар прихований адміном («видалений»): показуємо приглушено й не даємо
  // змінювати кількість — його можна лише прибрати з кошика
  unavailable?: boolean;
}

const shouldShowSize = (size: string) => size && size.trim() !== '';

export const Position: FC<IPositionProps> = ({
  id,
  price,
  cover,
  coverThumb,
  name,
  size,
  salePrice,
  quantity,
  available,
  unavailable = false,
}) => {
  const dispatch = useAppDispatch();
  const idUser = useAppSelector((store) => store.user.userData?.id);
  const [updating, setUpdating] = useState(false);
  const [quantityError, setQuantityError] = useState<string | null>(null);

  const pickUpProduct = () => {
    dispatch(pickUpFromTheCart({ idProduct: id, size, idUser }));
  };

  const canDecrease = !unavailable && quantity > 1 && !updating;
  const canIncrease =
    !unavailable && !updating && (available == null || quantity < available);

  const changeQuantity = async (nextQuantity: number) => {
    setUpdating(true);
    setQuantityError(null);
    const message = await dispatch(
      changeCartItemQuantity({
        idProduct: id,
        size,
        quantity: nextQuantity,
        available,
      }),
    );
    setUpdating(false);
    if (message) setQuantityError(message);
  };

  // Якщо залишок упав одразу на кілька одиниць, «−» одразу зменшує до
  // доступної кількості, щоб не доводилося кілька разів натикатися на 400
  const decreaseQuantity = () => {
    const nextQuantity =
      available != null && quantity > available
        ? Math.max(1, Math.min(quantity - 1, available))
        : quantity - 1;
    changeQuantity(nextQuantity);
  };

  // Залишок зменшився після того, як товар уже лежав у кошику
  const stockShortage = available != null && quantity > available;

  return (
    <Box
      sx={{
        py: 3,
        borderBottom: '1px solid',
        borderColor: 'rgba(175, 179, 179, 0.1)',
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Box sx={{ display: 'flex', gap: 3 }}>
        {/* Product thumbnail */}
        <Box
          sx={{
            width: 80,
            height: 96,
            flexShrink: 0,
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: '#eceeee',
            opacity: unavailable ? 0.5 : 1,
          }}
        >
          <Link href={'/product/' + id}>
            <img
              src={coverThumb || cover}
              alt={name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Link>
        </Box>

        {/* Product info */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', py: 0.5, opacity: unavailable ? 0.55 : 1 }}>
          <Box>
            <Link href={'/product/' + id} style={{ textDecoration: 'none' }}>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'text.primary',
                  lineHeight: 1.3,
                }}
              >
                {name}
              </Typography>
            </Link>
            {shouldShowSize(size) && (
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                Розмір: {size}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#777b7c' }}>
                Кількість:
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid rgba(175, 179, 179, 0.35)',
                  borderRadius: 1,
                }}
              >
                <IconButton
                  aria-label="Зменшити кількість"
                  size="small"
                  disabled={!canDecrease}
                  onClick={decreaseQuantity}
                  sx={{ width: 28, height: 28, borderRadius: 0 }}
                >
                  <RemoveIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <Typography
                  sx={{
                    minWidth: 24,
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    color: 'text.primary',
                  }}
                >
                  {quantity}
                </Typography>
                <IconButton
                  aria-label="Збільшити кількість"
                  size="small"
                  disabled={!canIncrease}
                  onClick={() => changeQuantity(quantity + 1)}
                  sx={{ width: 28, height: 28, borderRadius: 0 }}
                >
                  <AddIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </Box>
            <PriceBox salePrice={salePrice} price={price} />
          </Box>
        </Box>

        {/* Remove button */}
        <IconButton
          onClick={pickUpProduct}
          size="small"
          sx={{
            alignSelf: 'flex-start',
            color: '#afb3b3',
            '&:hover': { color: '#a73b21' },
          }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Товар приховали після того, як його поклали в кошик */}
      {unavailable && (
        <Typography sx={{ fontSize: '0.75rem', color: '#a73b21', mt: 1 }}>
          Товар більше недоступний
        </Typography>
      )}
      {/* Позиції більше немає в потрібній кількості на складі */}
      {!unavailable && stockShortage && (
        <Typography sx={{ fontSize: '0.75rem', color: '#a73b21', mt: 1 }}>
          {available === 0 ? 'Немає в наявності' : `Доступно: ${available}`}
        </Typography>
      )}
      {quantityError && (
        <Typography sx={{ fontSize: '0.75rem', color: '#a73b21', mt: 1 }}>
          {quantityError}
        </Typography>
      )}
    </Box>
  );
};
