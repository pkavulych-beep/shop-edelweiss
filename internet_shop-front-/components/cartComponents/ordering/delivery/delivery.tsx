import { NextPage } from "next";
import { Box, MenuItem, TextField } from "@mui/material";
import * as React from "react";
import { CustomSelector } from "./CustomeSelector";
import { useEffect, useState } from "react";
import Typography from "@mui/material/Typography";
import { mailApi } from "../../../../api/novaposhtaApi";
import { CustomAutocomplete } from "./CustomAutocomplete";

interface IDeliveryProps {
  cityName: string;
  setCity: React.Dispatch<React.SetStateAction<string>>;
  setDepartment: React.Dispatch<React.SetStateAction<string>>;
}

const DeliveryComponent: NextPage<IDeliveryProps> = ({
  cityName,
  setCity,
  setDepartment,
}) => {
  console.log("Delivery");
  const [departmentsArr, setDepartmentsArr] = useState([]);
  const [delayId, setDelayId] = useState(null);

  const onChangeCity = (e) => {
    setCity(e.target.value);
  };

  useEffect(() => {
    clearTimeout(delayId);
    if (cityName) {
      setDelayId(
        setTimeout(async function () {
          const departments = await mailApi.getDepartment(cityName);
          setDepartmentsArr(departments);
        }, 1400)
      );
    }
  }, [cityName]);

  const handleChange = (event) => {
    setDepartment(event.target.textContent);
  };

  return (
    <Box minWidth={"40%"}>
      <Typography variant="h6" sx={{ marginTop: 3 }}>
        ДОСТАВКА НОВОЮ ПОШТОЮ
      </Typography>
      <TextField
        value={cityName}
        onChange={onChangeCity}
        placeholder="Місто"
        variant="standard"
        fullWidth
        sx={{ marginTop: 4 }}
      />
      <CustomAutocomplete
        disablePortal
        id="combo-box-demo"
        options={departmentsArr}
        fullWidth
        onChange={handleChange}
        renderInput={(params) => (
          <TextField {...params} label="Відділення" variant="standard" />
        )}
      />
    </Box>
  );
};

export const Delivery = React.memo(DeliveryComponent);
