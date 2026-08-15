import React, { useState, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import Box from '@mui/material/Box';

interface PriceRangeFilterProps {
  priceMin?: number;
  priceMax?: number;
  onChange: (min?: number, max?: number) => void;
}

const MIN_PRICE = 0;
const MAX_PRICE = 50000;

const PriceRangeFilter: React.FC<PriceRangeFilterProps> = ({
  priceMin,
  priceMax,
  onChange,
}) => {
  const [value, setValue] = useState<number[]>([
    priceMin ?? MIN_PRICE,
    priceMax ?? MAX_PRICE,
  ]);

  useEffect(() => {
    setValue([priceMin ?? MIN_PRICE, priceMax ?? MAX_PRICE]);
  }, [priceMin, priceMax]);

  const handleChange = (_: Event, newValue: number | number[]) => {
    setValue(newValue as number[]);
  };

  const handleChangeCommitted = (
    _: React.SyntheticEvent | Event,
    newValue: number | number[],
  ) => {
    const [min, max] = newValue as number[];
    onChange(
      min > MIN_PRICE ? min : undefined,
      max < MAX_PRICE ? max : undefined,
    );
  };

  return (
    <Box sx={{ py: 1.5 }}>
      <Typography
        sx={{
          fontSize: '0.65rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          color: 'text.secondary',
          mb: 2,
        }}
      >
        Ціна
      </Typography>
      <Box sx={{ px: 0.5 }}>
        <Slider
          value={value}
          onChange={handleChange}
          onChangeCommitted={handleChangeCommitted}
          min={MIN_PRICE}
          max={MAX_PRICE}
          step={100}
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => `${v.toLocaleString('uk-UA')} ₴`}
          sx={{
            color: '#745c00',
            height: 3,
            '& .MuiSlider-thumb': {
              width: 16,
              height: 16,
              bgcolor: '#745c00',
              border: '2px solid #745c00',
              '&:hover, &.Mui-focusVisible': {
                boxShadow: '0 0 0 6px rgba(116, 92, 0, 0.15)',
              },
              '&.Mui-active': {
                boxShadow: '0 0 0 8px rgba(116, 92, 0, 0.2)',
              },
            },
            '& .MuiSlider-track': {
              bgcolor: '#745c00',
              border: 'none',
            },
            '& .MuiSlider-rail': {
              bgcolor: '#e6e9e9',
              opacity: 1,
            },
            '& .MuiSlider-valueLabel': {
              bgcolor: '#745c00',
              fontSize: '0.7rem',
              borderRadius: 1,
            },
          }}
        />
      </Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mt: 0.5,
        }}
      >
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
          {value[0].toLocaleString('uk-UA')} ₴
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
          {value[1].toLocaleString('uk-UA')} ₴
        </Typography>
      </Box>
    </Box>
  );
};

export default PriceRangeFilter;
