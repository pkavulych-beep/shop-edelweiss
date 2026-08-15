import { FC } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { PriceBox } from '../../PriceBox/PriceBox';
import * as React from 'react';
import Link from 'next/link';
import { pickUpFromTheCart } from '../../../redux/slices/cart-reducer';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';

export interface IPositionProps {
  id: number;
  cover: string;
  name: string;
  size: string;
  price: number;
  salePrice: number;
  quantity: number;
}

export const Position: FC<IPositionProps> = ({
  id,
  price,
  cover,
  name,
  size,
  salePrice,
  quantity,
}) => {
  const dispatch = useAppDispatch();
  const idUser = useAppSelector((store) => store.user.userData?.id);

  const pickUpProduct = () => {
    dispatch(pickUpFromTheCart({ idProduct: id, size, idUser }));
  };

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 3,
        py: 3,
        borderBottom: '1px solid',
        borderColor: 'rgba(175, 179, 179, 0.1)',
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      {/* Product thumbnail */}
      <Box
        sx={{
          width: 80,
          height: 96,
          flexShrink: 0,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: '#eceeee',
        }}
      >
        <Link href={'/product/' + id}>
          <a>
            <img
              src={cover}
              alt={name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </a>
        </Link>
      </Box>

      {/* Product info */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', py: 0.5 }}>
        <Box>
          <Link href={'/product/' + id}>
            <a style={{ textDecoration: 'none' }}>
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
            </a>
          </Link>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
            Розмір: {size}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.75rem', color: '#777b7c' }}>
            Кількість: {quantity}
          </Typography>
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
  );
};
