import { FC, useEffect } from 'react';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { Form, useFormikContext } from 'formik';
import CustomizedInputBase from '../../CustomizedInputBase/CustomizedInputBase';
import { DialogHeader } from './dialogHeader/HeaderDialog';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { clearError } from '../../../redux/slices/auth-reducer';

interface ILoginForm {
  handleClose: () => void;
  setRegister: (a: boolean) => void;
}

export const LoginForm: FC<ILoginForm> = ({ handleClose, setRegister }) => {
  const dispatch = useAppDispatch();
  const error = useAppSelector((store) => store.user.error);
  const { values } = useFormikContext();

  useEffect(() => {
    if (error) {
      dispatch(clearError());
    }
  }, [values]);

  return (
    <Form>
      <DialogHeader text="Вхід" handleClose={handleClose} />
      <DialogContent sx={{ px: 3, pt: 1 }}>
        <Typography
          variant="subtitle2"
          sx={{ color: 'text.secondary', mb: 2 }}
        >
          Акаунт Edelweiss
        </Typography>
        <CustomizedInputBase type="string" name="phoneNumber" placeholder="Номер телефону" phoneMask />
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
  );
};