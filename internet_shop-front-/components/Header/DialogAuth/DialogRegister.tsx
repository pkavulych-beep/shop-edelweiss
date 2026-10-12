import { FC } from 'react';
import Dialog from '@mui/material/Dialog';
import * as React from 'react';
import { Formik, FormikHelpers } from 'formik';
import { RegisterFormValidation } from './FormsValidation';
import { useAppDispatch } from '../../../redux/hooks';
import { registerUser, clearError } from '../../../redux/slices/auth-reducer';
import { RegisterForm } from './RegisterForm';

interface IDialogRegister {
  open: boolean;
  setRegister(a: boolean): void;
  setLogin(a: boolean): void;
}

export const DialogRegister: FC<IDialogRegister> = ({ open, setRegister, setLogin }) => {
  const dispatch = useAppDispatch();

  const handleClose = () => {
    setRegister(false);
  };

  const submit = async (values: any, { resetForm }: FormikHelpers<any>) => {
    dispatch(clearError());
    const dto = { ...values, email: values.email.trim() || undefined };
    let res = await dispatch(registerUser(dto));
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
        <RegisterForm handleClose={handleClose} setLogin={setLogin} />
      </Formik>
    </Dialog>
  );
};