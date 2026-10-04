import React from 'react';
import { useRouter } from 'next/router';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import FilterGroup from './FilterGroup';
import PriceRangeFilter from './PriceRangeFilter';
import {
  categoryLabels,
  seasonLabels,
  sortOptions,
  commonSizes,
  commonColors,
  womenOnlyCategories,
} from './filterLabels';

interface FilterSidebarProps {
  gender?: string;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({ gender }) => {
  const router = useRouter();
  const query = router.query as Record<string, string>;

  const updateQuery = (updates: Record<string, string | undefined>) => {
    const newQuery = { ...query };
    Object.entries(updates).forEach(([key, val]) => {
      if (val === undefined || val === '') {
        delete newQuery[key];
      } else {
        newQuery[key] = val;
      }
    });
    delete newQuery.page;
    router.push({ pathname: router.pathname, query: newQuery }, undefined, { shallow: false });
  };

  const getSelected = (key: string): string[] => {
    const val = query[key];
    if (!val) return [];
    return val.split(',');
  };

  const setMultiFilter = (key: string, values: string[]) => {
    updateQuery({ [key]: values.length > 0 ? values.join(',') : undefined });
  };

  // Filter out women-only categories for men
  const filteredCategoryLabels = gender === 'man'
    ? Object.fromEntries(
        Object.entries(categoryLabels).filter(([key]) => !womenOnlyCategories.includes(key))
      )
    : categoryLabels;

  const categoryOptions = Object.entries(filteredCategoryLabels).map(([value, label]) => ({
    value,
    label,
  }));

  const seasonOptions = Object.entries(seasonLabels).map(([value, label]) => ({
    value,
    label,
  }));

  const sizeOptions = commonSizes.map((s) => ({ value: s, label: s }));
  const colorOptions = commonColors.map((c) => ({ value: c, label: c }));

  return (
    <Box sx={{ width: { xs: '100%', md: 240 }, flexShrink: 0 }}>
      {/* Sort */}
      <Box sx={{ mb: 3 }}>
        <Typography
          sx={{
            fontSize: '0.65rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: 'text.secondary',
            mb: 1,
          }}
        >
          Сортувати
        </Typography>
        <Select
          value={query.sort || 'newest'}
          onChange={(e) => updateQuery({ sort: e.target.value })}
          size="small"
          fullWidth
          sx={{
            bgcolor: '#f2f4f4',
            borderRadius: 2,
            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: '1px solid #745c00' },
            fontSize: '0.8rem',
          }}
        >
          {sortOptions.map((opt) => (
            <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.8rem' }}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* On Sale */}
      <FormControlLabel
        control={
          <Switch
            checked={query.onSale === 'true'}
            onChange={(e) =>
              updateQuery({ onSale: e.target.checked ? 'true' : undefined })
            }
            size="small"
          />
        }
        label={
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            Тільки зі знижкою
          </Typography>
        }
        sx={{ mb: 2 }}
      />

      <FilterGroup
        title="Категорія"
        options={categoryOptions}
        selected={getSelected('category')}
        onChange={(vals) => setMultiFilter('category', vals)}
        defaultExpanded
      />

      <PriceRangeFilter
        priceMin={query.priceMin ? Number(query.priceMin) : undefined}
        priceMax={query.priceMax ? Number(query.priceMax) : undefined}
        onChange={(min, max) =>
          updateQuery({
            priceMin: min?.toString(),
            priceMax: max?.toString(),
          })
        }
      />

      <FilterGroup
        title="Розмір"
        options={sizeOptions}
        selected={getSelected('size')}
        onChange={(vals) => setMultiFilter('size', vals)}
      />

      <FilterGroup
        title="Колір"
        options={colorOptions}
        selected={getSelected('color')}
        onChange={(vals) => setMultiFilter('color', vals)}
      />

      <FilterGroup
        title="Сезон"
        options={seasonOptions}
        selected={getSelected('season')}
        onChange={(vals) => setMultiFilter('season', vals)}
      />
    </Box>
  );
};

export default FilterSidebar;
