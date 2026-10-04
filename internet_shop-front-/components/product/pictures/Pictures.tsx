import { NextPage } from 'next';
import style from '../../../styles/Product.module.scss';
import { useState } from 'react';
import { photo } from '../../../redux/Types/ProductType';
import { PicturesArr } from './PicturesArr';

interface IPicturesProps {
  photosArr: photo[];
}

export const Pictures: NextPage<IPicturesProps> = ({ photosArr }) => {
  const [selectPhoto, setPhoto] = useState(0);
  return (
    <>
      <PicturesArr setPhoto={setPhoto} photosArr={photosArr} />
      <img className={style.img} src={photosArr[selectPhoto].url} alt='' />
    </>
  );
};
