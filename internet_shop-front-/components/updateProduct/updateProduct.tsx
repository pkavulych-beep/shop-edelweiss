import { NextPage } from "next";
import { Button, Dialog } from "@mui/material";
import { Formik } from "formik";
import { Validatione } from "../CreateNewDish/Validatione";
import DishForm from "../CreateNewDish/DishForm";
import React, { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { Api } from "../../api/Api";
import { setCurrentProduct } from "../../redux/slices/product-reducer";

interface IUpdateProductProps {
  idProduct: number | null;
}

export const UpdateProduct: NextPage<IUpdateProductProps> = ({ idProduct }) => {
  const dispatch = useAppDispatch();

  const { currentProduct } = useAppSelector((store) => store.product);
  const { id, ...oldDataProduct } = currentProduct;

  const [open, setOpen] = useState(false);
  const [photoFiles, setPhotoFiles] = useState(null);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const { cover, photos, ...initialValues } = oldDataProduct;

  return (
    <div>
      <Button variant="contained" color="primary" onClick={handleClickOpen}>
        поміняти дані цього товару
      </Button>
      <Dialog
        open={open}
        title={"Here you can update the product"}
        onClose={handleClose}
      >
        {
          <Formik
            initialValues={initialValues}
            validationSchema={Validatione}
            onSubmit={async (values, { setSubmitting, resetForm }) => {
              const res = await Api().product.update(idProduct, values);
              const updatedProduct = { ...res, photos };
              dispatch(setCurrentProduct(updatedProduct));
              setSubmitting(false);
              handleClose();
              resetForm();
            }}
          >
            <DishForm
              handleClose={handleClose}
              nameRightBtn={"Обновити"}
              setPhotos={setPhotoFiles}
            />
          </Formik>
        }
      </Dialog>
    </div>
  );
};
