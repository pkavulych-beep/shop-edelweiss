import React, { ChangeEvent, FC } from 'react';
import { useField } from 'formik';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { maskPhoneInput } from '../../utils/phone';

interface Props {
  type: string;
  name: string;
  placeholder: string;
  multiline?: boolean;
  phoneMask?: boolean;
}

const CustomizedInputBase: FC<Props> = ({
  placeholder,
  type,
  name,
  multiline = false,
  phoneMask = false,
}) => {
  const [field, meta, helpers] = useField(name);
  const hasError = meta.touched && !!meta.error;

  const inputProps = phoneMask
    ? {
        ...field,
        value: maskPhoneInput(field.value ?? ''),
        inputMode: 'tel' as const,
        onChange: (event: ChangeEvent<HTMLInputElement>) =>
          helpers.setValue(
            maskPhoneInput(event.target.value, field.value ?? ''),
          ),
      }
    : field;

  return (
    <>
      <TextField
        error={hasError}
        placeholder={placeholder}
        inputProps={inputProps}
        margin="dense"
        label={placeholder}
        type={type}
        fullWidth
        variant="outlined"
        multiline={multiline}
        size="small"
        sx={{
          mb: 1,
          '& .MuiOutlinedInput-root': {
            bgcolor: hasError ? '#fff7f6' : '#e6e9e9',
            borderRadius: 2,
            '& fieldset': {
              border: hasError ? '1px solid #a73b21' : 'none',
            },
            '&:hover fieldset': {
              border: hasError ? '1px solid #a73b21' : 'none',
            },
            '&.Mui-focused fieldset': {
              border: hasError ? '1px solid #a73b21' : '1px solid #745c00',
            },
            '&.Mui-focused': {
              bgcolor: '#ffffff',
            },
          },
          '& .MuiInputLabel-root': {
            fontSize: '0.85rem',
            '&.Mui-focused': {
              color: hasError ? '#a73b21' : '#745c00',
            },
          },
        }}
      />
      {hasError && (
        <Typography
          sx={{
            color: '#a73b21',
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            mb: 0.5,
          }}
        >
          {meta.error}
        </Typography>
      )}
    </>
  );
};

export default CustomizedInputBase;
