import React from 'react';
import { Field, FieldArray, Form, useFormikContext } from 'formik';
import { Alert, Box, Button, Grid, IconButton, MenuItem, TextField } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CustomizedInputBase from '../CustomizedInputBase/CustomizedInputBase';
import { Gender, Category, Season } from '../../redux/Types/ProductType';
import { categoryLabels, seasonLabels } from '../FilterSidebar/filterLabels';
import { ISizeStockRow } from './sizeStock';

interface IDishFormProps {
  handleClose: () => void;
  nameRightBtn: string;
  // Без setPhotos вибір фото не показується (наприклад, у формі редагування)
  setPhotos?: (files: FileList | null) => void;
  errorMessage?: string | null;
}

const DishForm = ({ handleClose, nameRightBtn, setPhotos, errorMessage }: IDishFormProps) => {
  const { values, errors } = useFormikContext<{ sizeStock: ISizeStockRow[] }>();
  const rows = values.sizeStock ?? [];
  // Помилка всього масиву (наприклад, повтор розміру) — рядок, помилки рядків — масив
  const sizeStockError = typeof errors.sizeStock === 'string' ? errors.sizeStock : null;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotos(e.target.files);
  };

  return (
    <Form autoComplete="off" style={{ width: 600, padding: 14 }}>
      <CustomizedInputBase type="text" name="name" placeholder="Назва" />
      {setPhotos && (
        <>
          <p>Оберіть фото</p>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={onChange}
          />
        </>
      )}
      <CustomizedInputBase type="text" name="description" placeholder="Опис" multiline={true} />
      <CustomizedInputBase type="text" name="brand" placeholder="Бренд" />

      {/* Категорія */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ margin: '8px 0 4px' }}>Категорія</p>
        <Field as="select" name="category" style={{ width: '100%', padding: 8, fontSize: 14 }}>
          <option value="">Оберіть категорію</option>
          {Object.entries(categoryLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Field>
      </div>

      <CustomizedInputBase type="text" name="subcategory" placeholder="Підкатегорія" />

      {/* Стать */}
      <div role="group" aria-labelledby="gender-group" style={{ marginBottom: 8 }}>
        <p style={{ margin: '8px 0 4px' }}>Стать</p>
        <label style={{ marginRight: 12 }}>
          <Field type="radio" name="gender" value={Gender.Man} /> Чоловіча
        </label>
        <label style={{ marginRight: 12 }}>
          <Field type="radio" name="gender" value={Gender.Woman} /> Жіноча
        </label>
        <label>
          <Field type="radio" name="gender" value={Gender.Unisex} /> Унісекс
        </label>
      </div>

      {/* Сезон */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ margin: '8px 0 4px' }}>Сезон</p>
        <Field as="select" name="season" style={{ width: '100%', padding: 8, fontSize: 14 }}>
          {Object.entries(seasonLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Field>
      </div>

      <CustomizedInputBase type="text" name="colors" placeholder="Кольори (через кому: Чорний, Білий)" />
      <CustomizedInputBase type="text" name="material" placeholder="Матеріал" />
      <CustomizedInputBase type="text" name="weight" placeholder="Вага" />

      {/* Розміри й залишок: без жодного розміру кількість вказується одним полем */}
      <p style={{ margin: '8px 0 4px' }}>Розміри та кількість</p>
      <FieldArray name="sizeStock">
        {({ push, remove }) => (
          <>
            {rows.map((_, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                  <CustomizedInputBase type="text" name={`sizeStock.${index}.size`} placeholder="Розмір" />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <CustomizedInputBase type="number" name={`sizeStock.${index}.count`} placeholder="Кількість" />
                </Box>
                <IconButton aria-label="Видалити розмір" onClick={() => remove(index)} sx={{ mt: 1 }}>
                  <DeleteOutlineIcon />
                </IconButton>
              </Box>
            ))}
            {sizeStockError && <Alert severity="error" sx={{ mb: 1 }}>{sizeStockError}</Alert>}
            <Button onClick={() => push({ size: '', count: '' })} sx={{ mb: 1 }}>
              Додати розмір
            </Button>
          </>
        )}
      </FieldArray>
      {rows.length === 0 && <CustomizedInputBase type="number" name="count" placeholder="Кількість" />}
      <CustomizedInputBase type="number" name="price" placeholder="Ціна" />
      <CustomizedInputBase type="number" name="salePrice" placeholder="Ціна зі знижкою" />

      {errorMessage && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {errorMessage}
        </Alert>
      )}

      <Grid container direction="row" justifyContent="space-around" alignItems="center" sx={{ mt: 2 }}>
        <Button onClick={handleClose} color="primary">
          Скасувати
        </Button>
        <Button type="submit" variant="contained" color="primary">
          {nameRightBtn}
        </Button>
      </Grid>
    </Form>
  );
};

export default DishForm;
