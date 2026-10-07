import { FC } from 'react';
import { useAppSelector } from '../../redux/hooks';
import s from './ProductsList.module.scss';
import Link from 'next/link';

export const ProductsList: FC = () => {
  const data = useAppSelector((store) => store.product.data);

  if (!data) return null;

  return (
    <div className={s.container}>
      {data.map((product) => {
        const { id, cover, name, salePrice, price, brand, category } = product;
        return (
          <Link key={id} href={'/product/' + id} className={s.card}>
            <div className={s.imageWrapper}>
              <img
                className={s.image}
                src={cover}
                alt={name}
                loading="lazy"
              />
            </div>
            {(brand || category) && (
              <p className={s.meta}>
                {brand || category}
              </p>
            )}
            <p className={s.name}>{name}</p>
            <div className={s.price}>
              {salePrice ? (
                <>
                  <span className={s.salePrice}>{salePrice} грн</span>
                  <span className={s.oldPrice}>{price} грн</span>
                </>
              ) : (
                <span>{price} грн</span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
};
