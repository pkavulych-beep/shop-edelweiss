import React, { useState } from 'react';
import { Formik } from 'formik';
import { Validatione } from './Validatione';
import DishForm from './DishForm';
import { Alert, Button, Dialog, Snackbar } from '@mui/material';
import { saveNewProduct } from '../../redux/slices/product-reducer';
import { useAppDispatch } from '../../redux/hooks';

const CreateNewDish = () => {
  const dispatch = useAppDispatch();

  const [open, setOpen] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<FileList | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSubmitError(null);
    setPhotoFiles(null);
  };

  const onSubmit = async (values, setSubmitting, resetForm) => {
    if (!photoFiles?.length) {
      setSubmitError('Додайте хоча б одне фото товару');
      setSubmitting(false);
      return;
    }
    setSubmitError(null);
    const formData = new FormData();
    for (let x = 0; x < photoFiles.length; x++) {
      formData.append('photos', photoFiles[x]);
    }
    for (let key in values) {
      if (values[key] !== null && values[key] !== '' && values[key] !== undefined) {
        formData.append(key, values[key]);
      }
    }
    const { error } = await dispatch(saveNewProduct(formData));
    setSubmitting(false);
    if (error) {
      setSubmitError(error);
      return;
    }
    handleClose();
    resetForm();
    setSuccessOpen(true);
  };

  return (
    <div>
      <Button variant='contained' color='primary' onClick={handleClickOpen}>
        добавити товар
      </Button>
      <Dialog open={open} title={'Here you can create your own commodity'} onClose={handleClose}>
        {submitError && (
          <Alert severity='error' sx={{ m: 2, mb: 0 }}>
            {submitError}
          </Alert>
        )}
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
            onSubmit={(values, { setSubmitting, resetForm }) => onSubmit(values, setSubmitting, resetForm)}
          >
            <DishForm handleClose={handleClose} nameRightBtn={'Add'} setPhotos={setPhotoFiles} />
          </Formik>
        }
      </Dialog>
      <Snackbar
        open={successOpen}
        autoHideDuration={3000}
        onClose={() => setSuccessOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSuccessOpen(false)} severity='success' sx={{ width: '100%' }}>
          Товар успішно створено
        </Alert>
      </Snackbar>
    </div>
  );
};

export default CreateNewDish;
