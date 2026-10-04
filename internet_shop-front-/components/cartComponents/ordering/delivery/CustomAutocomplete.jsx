import styled from "@emotion/styled";
import { Autocomplete } from "@mui/material";

export const CustomAutocomplete = styled(Autocomplete)(() => ({
  minWidth: 290,
  borderRadius: 0,
  borderColor: "black",
  height: 55,
  margin: "12px 12px 20px 0",
}));
