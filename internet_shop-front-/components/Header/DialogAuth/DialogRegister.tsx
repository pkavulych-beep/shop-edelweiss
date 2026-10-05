import { FC } from 'react';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import * as React from 'react';
import { Form, Formik } from 'formik';
import CustomizedInputBase from '../../CustomizedInputBase/CustomizedInputBase';
import { RegisterFormValidation } from './FormsValidation';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { DialogHeader } from './dialogHeader/HeaderDialog';
import { registerUser } from '../../../redux/slices/auth-reducer';

interface IDialogRegister {
  open: boolean;
  setRegister(a: boolean): void;
  setLogin(a: boolean): void;
}

export const DialogRegister: FC<IDialogRegister> = ({ open, setRegister, setLogin }) => {
  const dispatch = useAppDispatch();
  const error = useAppSelector((store) => store.user.error);

  const handleClose = () => {
    setRegister(false);
  };

  const submit = async (values, { resetForm }) => {
    let res = await dispatch(registerUser(values));
    if (res === 'response') {
      handleClose();
      resetForm();
    }
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
        initialValues={{
          fullName: '',
          email: '',
          phoneNumber: '',
          password: '',
          confirmPassword: '',
        }}
        validationSchema={RegisterFormValidation}
        onSubmit={submit}
      >
        <Form>
          <DialogHeader text="Реєстрація" handleClose={handleClose} />
          <DialogContent sx={{ px: 3, pt: 1 }}>
            <Typography
              variant="subtitle2"
              sx={{ color: 'text.secondary', mb: 2 }}
            >
              Створіть акаунт Edelweiss
            </Typography>
            <CustomizedInputBase type="string" name="fullName" placeholder="ПІБ" />
            <CustomizedInputBase type="email" name="email" placeholder="Електронна пошта" />
            <CustomizedInputBase type="string" name="phoneNumber" placeholder="Номер телефону" />
            <CustomizedInputBase type="string" name="password" placeholder="Пароль" />
            <CustomizedInputBase type="string" name="confirmPassword" placeholder="Підтвердити пароль" />
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
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button
              onClick={() => {
                handleClose();
                setLogin(true);
              }}
              fullWidth
              variant="outlined"
            >
              Вхід
            </Button>
            <Button type="submit" fullWidth variant="contained">
              Зареєструватись
            </Button>
          </DialogActions>
        </Form>
      </Formik>
    </Dialog>
  );
};
