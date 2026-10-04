import { useAppSelector } from '../../redux/hooks';
import { Role } from '../../redux/Types/ProductType';
import React, { FC } from 'react';

interface IAdmin {
  children: React.ReactNode;
}

export const AdminWrapper: FC<IAdmin> = ({ children }) => {
  const value = useAppSelector(state => state.user.userData?.roles[0]?.value);

  if (value !== Role.admin) {
    return null;
  } else {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 250,
          justifyContent: 'space-around',
          border: '3px solid blue',
          padding: 14,
        }}
      >
        {children}
      </div>
    );
  }
};
