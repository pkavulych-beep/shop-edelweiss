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

const translateSlugs = (
  value: string,
  labels: Record<string, string>,
): string | null => {
  const translated = value
    .split(',')
    .map((slug) => labels[slug.trim()])
    .filter(Boolean);
  return translated.length > 0 ? translated.join(', ') : null;
};

const getFilterLabel = (key: string, value: string): string | null => {
  if (key === 'category') return translateSlugs(value, categoryLabels);
  if (key === 'season') return translateSlugs(value, seasonLabels);
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
  const activeKeys = Object.keys(filters).filter((k) => {
    if (['gender', 'sort', 'page', 'limit'].includes(k)) return false;
    const v = filters[k];
    if (!v) return false;
    if (v === 'false') return false;
    return true;
  });

  if (activeKeys.length === 0) return null;

  const labeledFilters = activeKeys
    .map((key) => ({ key, label: getFilterLabel(key, filters[key]) }))
    .filter((filter): filter is { key: string; label: string } => filter.label !== null);

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3, alignItems: 'center' }}>
      {labeledFilters.map(({ key, label }) => (
        <Chip
          key={key}
          label={label}
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
