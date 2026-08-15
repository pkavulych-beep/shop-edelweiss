import { FC } from 'react';
import Box from '@mui/material/Box';
import * as React from 'react';
import CustomizedInputBase from '../../../CustomizedInputBase/CustomizedInputBase';

const UserDataComponent: FC = () => {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 1,
      }}
    >
      <CustomizedInputBase type="string" name="fullName" placeholder="ПІБ" />
      <CustomizedInputBase type="string" name="phoneNumber" placeholder="Номер телефону" />
    </Box>
  );
};

export const NewUserData = React.memo(UserDataComponent);
