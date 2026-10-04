import * as yup from "yup";

export const ValidateOrder = yup.object().shape({
  phoneNumber: yup
    .number()
    .min(10, "введіть свій номер телефону")
    .required("Необхідний"),
  fullName: yup
    .string()
    .required("Необхідний")
    .min(6, "вкажіть ваше Призвіще Ім'я Побатькові"),
});
