import { FC } from 'react';
import Dialog from '@mui/material/Dialog';
import * as React from 'react';
import { Formik, FormikHelpers } from 'formik';
import { LoginFormValidation } from './FormsValidation';
import { useAppDispatch } from '../../../redux/hooks';
import { getUserData, clearError } from '../../../redux/slices/auth-reducer';
import { LoginForm } from './LoginForm';

interface IDialogLogin {
  open: boolean;
  setLogin(a: boolean): void;
  setRegister(a: boolean): void;
}

export const DialogLogin: FC<IDialogLogin> = ({ open, setRegister, setLogin }) => {
  const dispatch = useAppDispatch();

  const handleClose = () => {
    setLogin(false);
  };

  const submit = async (values: any, { resetForm }: FormikHelpers<any>) => {
    dispatch(clearError());
    let res = await dispatch(getUserData(values));
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
        initialValues={{ phoneNumber: '', password: '' }}
        validationSchema={LoginFormValidation}
        onSubmit={submit}
      >
        <LoginForm handleClose={handleClose} setRegister={setRegister} />
      </Formik>
    </Dialog>
  );
};