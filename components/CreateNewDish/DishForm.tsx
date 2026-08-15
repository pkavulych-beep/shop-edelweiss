import React from 'react';
import { Field, Form } from 'formik';
import { Button, Grid, MenuItem, TextField } from '@mui/material';
import CustomizedInputBase from '../CustomizedInputBase/CustomizedInputBase';
import { Gender, Category, Season } from '../../redux/Types/ProductType';
import { categoryLabels, seasonLabels } from '../FilterSidebar/filterLabels';

const DishForm = ({ handleClose, nameRightBtn, setPhotos }) => {
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotos(e.target.files);
  };

  return (
    <Form autoComplete="off" style={{ width: 600, padding: 14 }}>
      <CustomizedInputBase type="text" name="name" placeholder="Назва" />
      <p>Оберіть фото</p>
      <input type="file" multiple accept="image/*" onChange={onChange} />
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

      <CustomizedInputBase type="text" name="sizes" placeholder="Розміри (через кому: S, M, L)" />
      <CustomizedInputBase type="text" name="colors" placeholder="Кольори (через кому: Чорний, Білий)" />
      <CustomizedInputBase type="text" name="material" placeholder="Матеріал" />
      <CustomizedInputBase type="text" name="weight" placeholder="Вага" />
      <CustomizedInputBase type="number" name="count" placeholder="Кількість" />
      <CustomizedInputBase type="number" name="price" placeholder="Ціна" />
      <CustomizedInputBase type="number" name="salePrice" placeholder="Ціна зі знижкою" />

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
