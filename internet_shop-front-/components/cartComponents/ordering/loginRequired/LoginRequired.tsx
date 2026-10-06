import * as React from 'react';
import { FC, ReactNode, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import { useAppSelector } from '../../../../redux/hooks';
import { DialogLogin } from '../../../Header/DialogAuth/DialogLogin';
import { DialogRegister } from '../../../Header/DialogAuth/DialogRegister';

interface ILoginRequiredProps {
  children: ReactNode;
}

// Замовлення створює тільки авторизований користувач (POST /order під JwtAuthGuard),
// тому гостю замість форми пропонуємо увійти чи зареєструватися. Кошик гостя
// синхронізується з акаунтом одразу після входу (syncCartOnLogin).
export const LoginRequired: FC<ILoginRequiredProps> = ({ children }) => {
  const isLoggedIn = useAppSelector((store) => !!store.user.userData);
  const [dialogLoginOpen, setDialogLogin] = useState(false);
  const [dialogRegisterOpen, setDialogRegister] = useState(false);

  return (
    <>
      {isLoggedIn ? (
        children
      ) : (
        <Box
          sx={{
            bgcolor: '#eceeee',
            borderRadius: 3,
            p: { xs: 3, md: 5 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 2,
          }}
        >
          <PersonOutlineOutlinedIcon sx={{ fontSize: 48, color: '#afb3b3' }} />
          <Typography variant="h4" sx={{ fontSize: '1.15rem' }}>
            Увійдіть, щоб оформити замовлення
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', maxWidth: 360, lineHeight: 1.6 }}
          >
            Товари в кошику збережуться. Після входу ми підставимо ваші контактні
            дані, а замовлення з’явиться в особистому кабінеті.
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 1,
              width: '100%',
              maxWidth: 360,
              mt: 1,
            }}
          >
            <Button
              fullWidth
              variant="contained"
              onClick={() => setDialogLogin(true)}
              sx={{ py: 1.5 }}
            >
              Увійти
            </Button>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => setDialogRegister(true)}
              sx={{ py: 1.5 }}
            >
              Реєстрація
            </Button>
          </Box>
        </Box>
      )}

      {/* Діалоги лишаються змонтованими після входу, щоб коректно закритися */}
      <DialogLogin
        open={dialogLoginOpen}
        setLogin={setDialogLogin}
        setRegister={setDialogRegister}
      />
      <DialogRegister
        open={dialogRegisterOpen}
        setRegister={setDialogRegister}
        setLogin={setDialogLogin}
      />
    </>
  );
};
