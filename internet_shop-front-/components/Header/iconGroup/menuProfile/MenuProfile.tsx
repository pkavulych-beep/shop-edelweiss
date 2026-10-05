import { NextPage } from 'next';
import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Settings from '@mui/icons-material/Settings';
import Logout from '@mui/icons-material/Logout';
import { useAppDispatch } from '../../../../redux/hooks';
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
        <a>
          <MenuItem>
            <Avatar /> Історія покупок
          </MenuItem>
        </a>
      </Link>
      <Divider />
      <Link href='/profile'>
        <a style={{ textDecoration: 'none', color: 'inherit' }}>
          <MenuItem>
            <ListItemIcon>
              <Settings fontSize='small' />
            </ListItemIcon>
            Налаштування профілю
          </MenuItem>
        </a>
      </Link>
      <MenuItem onClick={logOut}>
        <ListItemIcon>
          <Logout fontSize='small' />
        </ListItemIcon>
        Вихід
      </MenuItem>
    </Menu>
  );
};
