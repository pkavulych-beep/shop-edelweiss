import * as yup from "yup";

export const ValidateOrder = yup.object().shape({
  phoneNumber: yup
    .number()
    .typeError("Введіть номер телефону цифрами")
    .min(10, "Введіть номер телефону")
    .required("Обов'язкове поле"),
  fullName: yup
    .string()
    .required("Обов'язкове поле")
    .min(6, "Вкажіть прізвище, ім'я та по батькові"),
});
