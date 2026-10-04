import React from 'react';
import { NextPage } from 'next';
import style from '../../../styles/Product.module.scss';
import { photo } from '../../../redux/Types/ProductType';

interface PicturesArr {
  photosArr: photo[];
  setPhoto: any;
}

const Component: NextPage<PicturesArr> = ({ photosArr, setPhoto }) => {
  return (
    <>
      <div className={style.wrapper_picture}>
        {photosArr.map((photo, index) => {
          return (
            <img
              key={photo.id}
              className={style.picture}
              src={photo.url}
              alt='photo'
              onClick={() => {
                setPhoto(index);
              }}
            />
          );
        })}
      </div>
    </>
  );
};

export const PicturesArr = React.memo(Component);
