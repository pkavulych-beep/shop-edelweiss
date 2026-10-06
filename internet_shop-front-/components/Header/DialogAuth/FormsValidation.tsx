import * as yup from "yup";
import { normalizePhone, PHONE_MESSAGE } from "../../../utils/phone";

// Рядок, а не число: yup.number().min(10) перевіряє значення числа,
// тож «12» така схема вважала б валідним номером
const phoneNumber = yup
  .string()
  .typeError("Введіть номер телефону")
  .trim()
  .required("Обов'язкове поле")
  .test("ua-phone", PHONE_MESSAGE, (value) => normalizePhone(value || "") !== null);

export const LoginFormValidation = yup.object().shape({
  phoneNumber,
  password: yup
    .string()
    .required("Обов'язкове поле")
    .min(6, "Мінімум символів: 6")
    .max(32, "Максимум символів: 32"),
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
