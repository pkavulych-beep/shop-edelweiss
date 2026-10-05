import * as yup from 'yup';

const yupStringStandard = (min, max) => {
  return yup
    .string()
    .typeError('Має бути текстом')
    .min(min, 'Мінімум символів: ' + min)
    .max(max, 'Максимум символів: ' + max)
    .required('Обов\'язкове поле');
};

// Порожнє числове поле приходить як '' — вважаємо його відсутнім значенням, а не NaN
const emptyToNull = (value, originalValue) => (originalValue === '' ? null : value);

export const Validatione = yup.object().shape({
  name: yupStringStandard(2, 100),
  count: yup.number().typeError('Має бути числом').transform(emptyToNull).max(10000, 'Забагато').nullable(),
  description: yupStringStandard(10, 900),
  gender: yup.string().typeError('Оберіть стать').required('Оберіть стать'),
  sizes: yup.string().typeError('Вкажіть розміри через кому').min(1, 'Обов\'язкове поле').required('Обов\'язкове поле'),
  weight: yup.string().nullable(),
  colors: yup.string().typeError('Вкажіть кольори через кому').nullable(),
  material: yup.string().nullable(),
  price: yup
    .number()
    .typeError('Має бути числом')
    .transform(emptyToNull)
    .nullable()
    .required('Обов\'язкове поле')
    .positive('Має бути більше 0'),
  salePrice: yup
    .number()
    .typeError('Має бути числом')
    .transform(emptyToNull)
    .positive('Має бути більше 0')
    .nullable(),
  brand: yup.string().nullable(),
  category: yup.string().nullable(),
  subcategory: yup.string().nullable(),
  season: yup.string().nullable(),
});
