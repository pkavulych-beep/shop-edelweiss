import React, { ChangeEvent, FC, useState } from 'react';
import { useField } from 'formik';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { maskPhoneInput } from '../../utils/phone';

interface Props {
  type: string;
  name: string;
  placeholder: string;
  multiline?: boolean;
  autoComplete?: string;
  phoneMask?: boolean;
}

const CustomizedInputBase: FC<Props> = ({
  placeholder,
  type,
  name,
  multiline = false,
  autoComplete,
  phoneMask = false,
}) => {
  const [field, meta, helpers] = useField(name);
  const hasError = meta.touched && !!meta.error;
  const isPassword = type === 'password';
  const [showPassword, setShowPassword] = useState(false);

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
    : // null/undefined у formik-значенні робить input неконтрольованим і дає
      // попередження React, тож зводимо їх до порожнього рядка
      { ...field, value: field.value ?? '' };

  return (
    <>
      <TextField
        error={hasError}
        placeholder={placeholder}
        inputProps={{ ...inputProps, autoComplete }}
        margin="dense"
        label={placeholder}
        type={isPassword && showPassword ? 'text' : type}
        fullWidth
        variant="outlined"
        multiline={multiline}
        size="small"
        InputProps={
          isPassword
            ? {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      type="button"
                      edge="end"
                      size="small"
                      aria-label={showPassword ? 'Сховати пароль' : 'Показати пароль'}
                      title={showPassword ? 'Сховати пароль' : 'Показати пароль'}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }
            : undefined
        }
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
