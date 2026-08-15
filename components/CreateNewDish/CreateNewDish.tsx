import React, { useState } from 'react';
import { Formik } from 'formik';
import { Validatione } from './Validatione';
import DishForm from './DishForm';
import { Button, Dialog } from '@mui/material';
import { saveNewProduct } from '../../redux/slices/product-reducer';
import { useAppDispatch } from '../../redux/hooks';

const CreateNewDish = () => {
  const dispatch = useAppDispatch();

  const [open, setOpen] = useState(false);
  const [photoFiles, setPhotoFiles] = useState(null);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const onSubmit = (values, setSubmitting, resetForm) => {
    const formData = new FormData();
    for (let x = 0; x < photoFiles.length; x++) {
      formData.append('photos', photoFiles[x]);
    }
    for (let key in values) {
      if (values[key] !== null && values[key] !== '' && values[key] !== undefined) {
        formData.append(key, values[key]);
      }
    }
    dispatch(saveNewProduct(formData));
    setSubmitting(false);
    handleClose();
    resetForm();
  };

  return (
    <div>
      <Button variant='contained' color='primary' onClick={handleClickOpen}>
        добавити товар
      </Button>
      <Dialog open={open} title={'Here you can create your own commodity'} onClose={handleClose}>
        {
          <Formik
            initialValues={{
              name: '',
              count: 0,
              description: '',
              weight: null,
              sizes: '',
              colors: '',
              material: null,
              price: null,
              salePrice: null,
              gender: null,
              category: '',
              subcategory: '',
              brand: '',
              season: 'all-season',
            }}
            validationSchema={Validatione}
            onSubmit={(values, { setSubmitting, resetForm }) => {
              onSubmit(values, setSubmitting, resetForm);
            }}
          >
            <DishForm handleClose={handleClose} nameRightBtn={'Add'} setPhotos={setPhotoFiles} />
          </Formik>
        }
      </Dialog>
    </div>
  );
};

export default CreateNewDish;
