import { NextPage } from "next";
import { Box, Link, TextField } from "@mui/material";
import * as React from "react";

interface IUkrposhtaDeliveryProps {
  cityName: string;
  department: string;
  setCity: React.Dispatch<React.SetStateAction<string>>;
  setDepartment: React.Dispatch<React.SetStateAction<string>>;
}

// Довідника відділень Укрпошти немає без токена за договором (#237),
// тому індекс відділення покупець вводить сам: рівно 5 цифр,
// як перевіряє бекенд (src/order/dto/ukrposhta-index.validator.ts)
export const isUkrposhtaIndexValid = (index: string): boolean =>
  /^\d{5}$/.test(index);

const UkrposhtaDeliveryComponent: NextPage<IUkrposhtaDeliveryProps> = ({
  cityName,
  department,
  setCity,
  setDepartment,
}) => {
  const indexError = department.length > 0 && !isUkrposhtaIndexValid(department);

  return (
    <Box minWidth={"40%"}>
      <TextField
        id="ukrposhta-city"
        label="Населений пункт"
        variant="standard"
        required
        fullWidth
        value={cityName}
        onChange={(e) => setCity(e.target.value)}
        sx={{ marginTop: 4 }}
      />
      <TextField
        id="ukrposhta-index"
        label="Індекс відділення"
        variant="standard"
        required
        fullWidth
        value={department}
        onChange={(e) => setDepartment(e.target.value)}
        inputProps={{ inputMode: "numeric" }}
        error={indexError}
        helperText={
          indexError
            ? "Введіть індекс із 5 цифр, наприклад 79000"
            : "5 цифр, наприклад 79000"
        }
        sx={{ marginTop: 4 }}
      />
      <Link
        href="https://offices.ukrposhta.ua/"
        target="_blank"
        rel="noopener noreferrer"
        sx={{ display: "inline-block", mt: 2, fontSize: "0.85rem" }}
      >
        Знайти індекс відділення
      </Link>
    </Box>
  );
};

export const UkrposhtaDelivery = React.memo(UkrposhtaDeliveryComponent);
