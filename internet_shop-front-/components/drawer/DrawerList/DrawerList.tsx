import { NextPage } from 'next';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import * as React from 'react';
import { Anchor } from '../Drawer';
import { GenderSwitch } from '../../Header/genderSwitch';
import Link from 'next/link';
import s from './DrawerList.module.scss';

interface IDrawerListProps {
  anchor: Anchor;
  toggleDrawer(a: Anchor, b: boolean);
}

export const DrawerList: NextPage<IDrawerListProps> = ({ anchor, toggleDrawer }) => {
  const menuItemsTop = [
    { name: 'ЗНИЖКИ', color: 'red', url: '/productsList/discounts' },
    { name: 'НОВИНКИ', color: 'green', url: '/productsList/newProducts' },
  ];
  const menuItemsBottom = [
    { name: 'НОВИНИ І ВІДГУКИ', color: 'gray', url: '/news' },
    { name: 'ДОСТАВКА, ОПЛАТА, ПОВЕРНЕННЯ', color: 'gray', url: '/info' },
  ];

  const renderList = itemsListArray => {
    return (
      <List>
        {itemsListArray.map(({ name, color, url }) => (
          <Link key={name} href={url}>
            <a>
              <ListItem button>
                <ListItemText primary={name} sx={{ color }} />
              </ListItem>
            </a>
          </Link>
        ))}
      </List>
    );
  };

  return (
    <Box
      className={s.wrapper}
      role='presentation'
      onClick={toggleDrawer(anchor, false)}
      onKeyDown={toggleDrawer(anchor, false)}
    >
      <GenderSwitch />
      {renderList(menuItemsTop)}
      <Divider color={'grey'} />
      {renderList(menuItemsBottom)}
    </Box>
  );
};
