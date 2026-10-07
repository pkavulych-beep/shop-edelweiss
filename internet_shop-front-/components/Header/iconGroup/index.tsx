import { NextPage } from 'next';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import AccountCircle from '@mui/icons-material/AccountCircle';
import { DialogLogin } from '../DialogAuth/DialogLogin';
import { DialogRegister } from '../DialogAuth/DialogRegister';
import { MenuProfile } from './menuProfile/MenuProfile';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import Badge from '@mui/material/Badge';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import * as React from 'react';
import { useState } from 'react';
import { useAppSelector } from '../../../redux/hooks';
import Link from 'next/link';

interface IIconGroupProps {}

export const IconGroup: NextPage<IIconGroupProps> = () => {
  const [dialogRegisterOpen, setDialogRegister] = useState(false);
  const [dialogLoginOpen, setDialogLogin] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const { userData } = useAppSelector(store => store.user);
  const cartCount = useAppSelector(store => store.cart.data?.length ?? 0);

  const openLogin = (e): void => {
    if (userData === null) {
      setDialogLogin(true);
    } else {
      handleClick(e);
    }
  };

  return (
    <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
      <IconButton onClick={openLogin} size='large' color='inherit'>
        <AccountCircle />
      </IconButton>
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
      <MenuProfile anchorEl={anchorEl} open={open} onClose={handleClose} onClick={handleClose} />
      <IconButton size='large' color='inherit'>
        <FavoriteBorderIcon />
      </IconButton>
      <Link href='/cart'>
        <IconButton size='large' color='inherit'>
          <Badge badgeContent={cartCount} color='error'>
            <ShoppingCartOutlinedIcon />
          </Badge>
        </IconButton>
      </Link>
    </Box>
  );
};
