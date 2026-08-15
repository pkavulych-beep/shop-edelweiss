import * as yup from 'yup';

const yupStringStandard = (min, max) => {
  return yup
    .string()
    .min(min, 'Мінімум символів: ' + min)
    .max(max, 'Максимум символів: ' + max)
    .required('Обов\'язкове поле');
};

export const Validatione = yup.object().shape({
  name: yupStringStandard(2, 100),
  count: yup.number().max(10000, 'Забагато').nullable(),
  description: yupStringStandard(10, 900),
  gender: yup.string().required('Оберіть стать'),
  sizes: yup.string().min(1, 'Обов\'язкове поле').required('Обов\'язкове поле'),
  weight: yup.string().nullable(),
  colors: yup.string().nullable(),
  material: yup.string().nullable(),
  price: yup.number().required('Обов\'язкове поле').positive('Має бути більше 0'),
  salePrice: yup.number().positive('Має бути більше 0').nullable(),
  brand: yup.string().nullable(),
  category: yup.string().nullable(),
  subcategory: yup.string().nullable(),
  season: yup.string().nullable(),
});
