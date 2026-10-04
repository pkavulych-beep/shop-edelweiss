import { FC } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface IPriceBoxProps {
  price: number;
  salePrice: number;
}

export const PriceBox: FC<IPriceBoxProps> = ({ salePrice, price }) => {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
      {salePrice ? (
        <>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '1.125rem',
              color: 'error.main',
              letterSpacing: '-0.02em',
            }}
          >
            {salePrice} грн
          </Typography>
          <Typography
            component="del"
            sx={{
              fontWeight: 400,
              fontSize: '0.875rem',
              color: 'text.secondary',
            }}
          >
            {price} грн
          </Typography>
        </>
      ) : (
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: '1.125rem',
            color: 'text.primary',
            letterSpacing: '-0.02em',
          }}
        >
          {price} грн
        </Typography>
      )}
    </Box>
  );
};
