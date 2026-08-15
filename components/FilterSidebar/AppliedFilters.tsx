import React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import { categoryLabels, seasonLabels } from './filterLabels';

interface AppliedFiltersProps {
  filters: Record<string, string>;
  onRemove: (key: string) => void;
  onClearAll: () => void;
}

const getFilterLabel = (key: string, value: string): string => {
  if (key === 'category') return categoryLabels[value] || value;
  if (key === 'season') return seasonLabels[value] || value;
  if (key === 'onSale') return 'Зі знижкою';
  if (key === 'priceMin') return `Від ${value} грн`;
  if (key === 'priceMax') return `До ${value} грн`;
  return value;
};

const AppliedFilters: React.FC<AppliedFiltersProps> = ({
  filters,
  onRemove,
  onClearAll,
}) => {
  const activeKeys = Object.keys(filters).filter(
    (k) => !['gender', 'sort', 'page', 'limit'].includes(k) && filters[k],
  );

  if (activeKeys.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3, alignItems: 'center' }}>
      {activeKeys.map((key) => (
        <Chip
          key={key}
          label={getFilterLabel(key, filters[key])}
          onDelete={() => onRemove(key)}
          size="small"
          sx={{
            bgcolor: '#eceeee',
            color: 'text.primary',
            fontWeight: 600,
            fontSize: '0.7rem',
            letterSpacing: '0.05em',
            '& .MuiChip-deleteIcon': {
              color: '#afb3b3',
              fontSize: '1rem',
              '&:hover': { color: '#745c00' },
            },
          }}
        />
      ))}
      <Button
        size="small"
        onClick={onClearAll}
        sx={{
          color: 'text.secondary',
          textTransform: 'none',
          fontSize: '0.8rem',
          '&:hover': { color: 'primary.main' },
        }}
      >
        Очистити все
      </Button>
    </Box>
  );
};

export default AppliedFilters;
