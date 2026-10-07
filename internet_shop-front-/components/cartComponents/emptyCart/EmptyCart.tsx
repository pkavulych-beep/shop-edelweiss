import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from 'next/link';
import * as React from 'react';
import { FC } from 'react';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';

interface IEmptyCartProps {
  title?: string;
}

export const EmptyCart: FC<IEmptyCartProps> = ({ title = 'Кошик порожній' }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        gap: 3,
        px: 2,
      }}
    >
      <ShoppingBagOutlinedIcon
        sx={{ fontSize: 64, color: '#afb3b3' }}
      />
      <Typography
        variant="h4"
        sx={{ fontSize: '1.25rem', color: 'text.secondary' }}
      >
        {title}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', textAlign: 'center', maxWidth: 300 }}
      >
        Додайте товари, які вам сподобались, та оформіть замовлення
      </Typography>
      <Link href="/" style={{ textDecoration: 'none' }}>
        <Button variant="contained" sx={{ px: 5, py: 1.5 }}>
          На головну
        </Button>
      </Link>
    </Box>
  );
};
