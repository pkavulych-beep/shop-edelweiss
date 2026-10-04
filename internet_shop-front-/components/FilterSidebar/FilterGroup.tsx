import React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface FilterGroupProps {
  title: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  defaultExpanded?: boolean;
}

const FilterGroup: React.FC<FilterGroupProps> = ({
  title,
  options,
  selected,
  onChange,
  defaultExpanded = false,
}) => {
  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <Accordion defaultExpanded={defaultExpanded}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary', fontSize: '1.1rem' }} />}
      >
        <Typography
          variant="subtitle2"
          sx={{ color: 'text.secondary' }}
        >
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <FormGroup>
          {options.map((opt) => (
            <FormControlLabel
              key={opt.value}
              control={
                <Checkbox
                  checked={selected.includes(opt.value)}
                  onChange={() => handleToggle(opt.value)}
                  size="small"
                  sx={{
                    color: '#afb3b3',
                    '&.Mui-checked': { color: '#745c00' },
                    py: 0.3,
                  }}
                />
              }
              label={
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.primary',
                    fontSize: '0.85rem',
                  }}
                >
                  {opt.label}
                </Typography>
              }
            />
          ))}
        </FormGroup>
      </AccordionDetails>
    </Accordion>
  );
};

export default FilterGroup;
