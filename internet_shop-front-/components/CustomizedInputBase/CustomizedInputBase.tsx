import React, { FC, useState } from 'react';
import { useField } from 'formik';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

interface Props {
  type: string;
  name: string;
  placeholder: string;
  multiline?: boolean;
  autoComplete?: string;
}

const CustomizedInputBase: FC<Props> = ({
  placeholder,
  type,
  name,
  multiline = false,
  autoComplete,
}) => {
  const [field, meta] = useField(name);
  const hasError = meta.touched && !!meta.error;
  const isPassword = type === 'password';
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <TextField
        error={hasError}
        placeholder={placeholder}
        inputProps={{ ...field, autoComplete }}
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
