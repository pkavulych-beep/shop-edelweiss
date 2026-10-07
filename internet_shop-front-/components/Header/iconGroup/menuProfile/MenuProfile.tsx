import { NextPage } from 'next';
import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Settings from '@mui/icons-material/Settings';
import Logout from '@mui/icons-material/Logout';
import PhoneInTalkOutlined from '@mui/icons-material/PhoneInTalkOutlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import { useAppDispatch, useAppSelector } from '../../../../redux/hooks';
import { Role } from '../../../../redux/Types/ProductType';
import { toLogOut } from '../../../../redux/slices/auth-reducer';
import Link from 'next/link';
import { classes } from './styleMenuProfile';

interface IMenuProfileProps {
  open: boolean;
  anchorEl: null | HTMLElement;
  onClose(): void;
  onClick(): void;
}

export const MenuProfile: NextPage<IMenuProfileProps> = ({ open, onClose, onClick, anchorEl }) => {
  const dispatch = useAppDispatch();
  const isAdmin = useAppSelector(
    state => state.user.userData?.roles.some(role => role.value === Role.admin) ?? false
  );

  const logOut = () => {
    dispatch(toLogOut());
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      onClick={onClick}
      PaperProps={{
        elevation: 0,
        sx: { ...classes },
      }}
      transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
    >
      <Link href='/orders'>
        <MenuItem>
          <Avatar /> Історія покупок
        </MenuItem>
      </Link>
      <Divider />
      <Link href='/profile' style={{ textDecoration: 'none', color: 'inherit' }}>
        <MenuItem>
          <ListItemIcon>
            <Settings fontSize='small' />
          </ListItemIcon>
          Налаштування профілю
        </MenuItem>
      </Link>
      {isAdmin && (
        <Link href='/admin/orders' style={{ textDecoration: 'none', color: 'inherit' }}>
          <MenuItem>
            <ListItemIcon>
              <ReceiptLongOutlined fontSize='small' />
            </ListItemIcon>
            Замовлення
          </MenuItem>
        </Link>
      )}
      {isAdmin && (
        <Link href='/quickOrders' style={{ textDecoration: 'none', color: 'inherit' }}>
          <MenuItem>
            <ListItemIcon>
              <PhoneInTalkOutlined fontSize='small' />
            </ListItemIcon>
            Заявки в 1 клік
          </MenuItem>
        </Link>
      )}
      <MenuItem onClick={logOut}>
        <ListItemIcon>
          <Logout fontSize='small' />
        </ListItemIcon>
        Вихід
      </MenuItem>
    </Menu>
  );
};
