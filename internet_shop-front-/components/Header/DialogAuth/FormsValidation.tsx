import * as yup from "yup";

export const LoginFormValidation = yup.object().shape({
  phoneNumber: yup
    .number()
    .typeError("Введіть номер телефону цифрами")
    .min(10, "Введіть номер телефону")
    .required("Обов'язкове поле"),
  password: yup
    .string()
    .required("Обов'язкове поле")
    .min(6, "Мінімум символів: 6"),
});

export const RegisterFormValidation = yup
  .object()
  .shape({
    fullName: yup
      .string()
      .required("Обов'язкове поле")
      .min(6, "Вкажіть прізвище, ім'я та по батькові"),
    email: yup.string().email("Некоректна адреса електронної пошти"),
    confirmPassword: yup
      .string()
      .oneOf([yup.ref("password"), null], "Паролі повинні збігатися")
      .required("Обов'язкове поле"),
  })
  .concat(LoginFormValidation);
