import * as yup from "yup";
import { normalizePhone, PHONE_MESSAGE } from "../../../../utils/phone";

export const ValidateOrder = yup.object().shape({
  phoneNumber: yup
    .string()
    .typeError("Введіть номер телефону")
    .trim()
    .required("Обов'язкове поле")
    .test("ua-phone", PHONE_MESSAGE, (value) => normalizePhone(value || "") !== null),
  fullName: yup
    .string()
    .required("Обов'язкове поле")
    .min(6, "Вкажіть прізвище, ім'я та по батькові"),
});
