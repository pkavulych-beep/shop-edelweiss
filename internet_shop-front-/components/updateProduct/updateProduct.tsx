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

// У БД sizes/colors — масиви, а у формі це рядок "S, M, L"
const arrayToString = (value: string[] | string | null | undefined) =>
  Array.isArray(value) ? value.join(", ") : value ?? "";

const getErrorMessage = (e) => {
  const message = e?.response?.data?.message;
  if (Array.isArray(message)) return message.join("; ");
  return message || "Не вдалося зберегти зміни. Спробуйте ще раз.";
};

export const UpdateProduct: NextPage<IUpdateProductProps> = ({ idProduct }) => {
  const dispatch = useAppDispatch();

  const { currentProduct } = useAppSelector((store) => store.product);

  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClickOpen = () => {
    setErrorMessage(null);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const initialValues = {
    name: currentProduct.name,
    count: currentProduct.count,
    description: currentProduct.description,
    weight: currentProduct.weight,
    sizes: arrayToString(currentProduct.sizes),
    colors: arrayToString(currentProduct.colors),
    material: currentProduct.material,
    price: currentProduct.price,
    salePrice: currentProduct.salePrice,
    gender: currentProduct.gender,
    category: currentProduct.category ?? "",
    subcategory: currentProduct.subcategory ?? "",
    brand: currentProduct.brand ?? "",
    season: currentProduct.season,
  };

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
            enableReinitialize
            validationSchema={Validatione}
            onSubmit={async (values, { setSubmitting }) => {
              setErrorMessage(null);
              try {
                // cast перетворює порожні числові поля ('') на null перед відправкою
                const res = await Api().product.update(idProduct, Validatione.cast(values));
                dispatch(setCurrentProduct({ ...res, photos: currentProduct.photos }));
                handleClose();
              } catch (e) {
                setErrorMessage(getErrorMessage(e));
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <DishForm
              handleClose={handleClose}
              nameRightBtn={"Обновити"}
              errorMessage={errorMessage}
            />
          </Formik>
        }
      </Dialog>
    </div>
  );
};
