import { FC } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import * as React from 'react';
import { CartItem, CartProductDetails } from '../../../redux/Types/ProductType';

interface ISumProps {
  items: CartItem[];
  productDetails: Record<number, CartProductDetails>;
}

export const Sum: FC<ISumProps> = ({ items, productDetails }) => {
  const total = items.reduce((sum, item) => {
    const details = productDetails[item.idProduct];
    if (!details) return sum;
    const price = details.salePrice ? details.salePrice : details.price;
    return sum + price * item.quantity;
  }, 0);

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        py: 2,
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{ color: 'text.secondary' }}
      >
        Сума до оплати
      </Typography>
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: '1.5rem',
          letterSpacing: '-0.02em',
          color: 'text.primary',
        }}
      >
        {total} грн
      </Typography>
    </Box>
  );
};
