import { NextPage } from "next";
import { Box, TextField } from "@mui/material";
import * as React from "react";
import Typography from "@mui/material/Typography";

interface IUserDataProps {
  fullName: string;
  setFullName: React.Dispatch<React.SetStateAction<string>>;
  phoneNumber: string;
  setPhoneNumber: React.Dispatch<React.SetStateAction<string>>;
}

const UserDataComponent: NextPage<IUserDataProps> = ({
  phoneNumber,
  setPhoneNumber,
  setFullName,
  fullName,
}) => {
  console.log("UserData");

  const onChangeName = (e) => {
    setFullName(e.target.value);
  };

  const onChangePhone = (e) => {
    setPhoneNumber(e.target.value);
  };

  return (
    <Box minWidth={"40%"}>
      <Typography variant="h6" sx={{ marginTop: 3 }}>
        ДАНІ ПОКУПЦЯ
      </Typography>
      <TextField
        value={fullName}
        onChange={onChangeName}
        placeholder="ПІБ"
        variant="standard"
        fullWidth
        sx={{ marginTop: 4 }}
      />
      <TextField
        value={phoneNumber}
        onChange={onChangePhone}
        placeholder="номер телефону"
        type="string"
        fullWidth
        variant="standard"
        sx={{ marginTop: 4 }}
      />
    </Box>
  );
};

export const UserData = React.memo(UserDataComponent);
