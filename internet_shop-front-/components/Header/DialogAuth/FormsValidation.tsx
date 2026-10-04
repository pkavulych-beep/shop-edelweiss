import * as yup from "yup";

export const LoginFormValidation = yup.object().shape({
  phoneNumber: yup
    .number()
    .min(10, "введіть свій номер телефону")
    .required("Необхідний"),
  password: yup.string().required("Необхідний").min(6),
});

export const RegisterFormValidation = yup
  .object()
  .shape({
    fullName: yup
      .string()
      .required("Необхідний")
      .min(6, "вкажіть ваше Призвіще Ім'я Побатькові"),
    email: yup.string().email(),
    confirmPassword: yup
      .string()
      .oneOf([yup.ref("password"), null], "Паролі повинні збігатися")
      .required("Необхідний"),
  })
  .concat(LoginFormValidation);
