import { FC } from 'react';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import * as React from 'react';
import GoogleIcon from '@mui/icons-material/Google';
import { Form, Formik } from 'formik';
import CustomizedInputBase from '../../CustomizedInputBase/CustomizedInputBase';
import { LoginFormValidation } from './FormsValidation';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { DialogHeader } from './dialogHeader/HeaderDialog';
import { getUserData } from '../../../redux/slices/auth-reducer';

interface IDialogLogin {
  open: boolean;
  setLogin(a: boolean): void;
  setRegister(a: boolean): void;
}

export const DialogLogin: FC<IDialogLogin> = ({ open, setRegister, setLogin }) => {
  const dispatch = useAppDispatch();
  const error = useAppSelector((store) => store.user.error);

  const handleClose = () => {
    setLogin(false);
  };

  return (
    <Dialog
      fullWidth
      maxWidth="xs"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0px 24px 48px rgba(47, 51, 52, 0.06)',
        },
      }}
    >
      <Formik
        initialValues={{ phoneNumber: '', password: '' }}
        validationSchema={LoginFormValidation}
        onSubmit={async (values, { resetForm }) => {
          let res = await dispatch(getUserData(values));
          if (res === 'response') {
            handleClose();
            resetForm();
          }
        }}
      >
        <Form>
          <DialogHeader text="Вхід" handleClose={handleClose} />
          <DialogContent sx={{ px: 3, pt: 1 }}>
            <Typography
              variant="subtitle2"
              sx={{ color: 'text.secondary', mb: 2 }}
            >
              Акаунт Edelweiss
            </Typography>
            <CustomizedInputBase type="string" name="phoneNumber" placeholder="Номер телефону" />
            <CustomizedInputBase
              type="password"
              name="password"
              placeholder="Пароль"
              autoComplete="current-password"
            />
            {error && (
              <Typography
                sx={{
                  color: 'error.main',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  mt: 1,
                }}
              >
                {error}
              </Typography>
            )}

            <Divider sx={{ my: 3 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                або
              </Typography>
            </Divider>

            <Button
              fullWidth
              variant="outlined"
              startIcon={<GoogleIcon />}
              sx={{ mb: 1 }}
            >
              Увійти через Google
            </Button>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button
              onClick={() => {
                handleClose();
                setRegister(true);
              }}
              fullWidth
              variant="outlined"
            >
              Реєстрація
            </Button>
            <Button type="submit" fullWidth variant="contained">
              Увійти
            </Button>
          </DialogActions>
        </Form>
      </Formik>
    </Dialog>
  );
};
