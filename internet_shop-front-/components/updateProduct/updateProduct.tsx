import { NextPage } from "next";
import { Button, Box, Dialog } from "@mui/material";
import { Formik } from "formik";
import { Validatione } from "../CreateNewDish/Validatione";
import DishForm from "../CreateNewDish/DishForm";
import React, { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { Api } from "../../api/Api";
import { setCurrentProduct } from "../../redux/slices/product-reducer";
import { productToRows, rowsToSizeStock } from "../CreateNewDish/sizeStock";

interface IUpdateProductProps {
  idProduct: number | null;
}

// У БД colors — масив, а у формі це рядок "S, M, L"
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
    sizeStock: productToRows(currentProduct),
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
    <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
      <Button
        variant="contained"
        color="primary"
        onClick={handleClickOpen}
        sx={{ whiteSpace: 'nowrap', height: 48, width: { xs: '100%', sm: 'auto' } }}
      >
        Редагувати товар
      </Button>
      <Dialog
        open={open}
        title={"Редагування товару"}
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
                const { sizeStock: rows, ...rest } = Validatione.cast(values);
                const sizeStock = rowsToSizeStock(rows);
                // З розмірами sizes і count бек виводить із sizeStock; без них розміри очищаємо
                const dto = sizeStock ? { ...rest, count: undefined, sizeStock } : { ...rest, sizeStock: null, sizes: [] };
                const res = await Api().product.update(idProduct, dto);
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
              nameRightBtn={"Зберегти"}
              errorMessage={errorMessage}
            />
          </Formik>
        }
      </Dialog>
    </Box>
  );
};
