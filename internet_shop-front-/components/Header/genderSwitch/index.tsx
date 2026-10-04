import { NextPage } from 'next';
import s from './genderSwitch.module.scss';
import { useAppSelector } from '../../../redux/hooks';
import { Gender } from '../../../redux/Types/ProductType';
import Link from 'next/link';

const forMan = 'ДЛЯ ХЛОПЦІВ';
const forWoman = 'ДЛЯ ДІВЧАТ';

export const GenderSwitch: NextPage = () => {
  const { gender } = useAppSelector(state => state.product.category);

  return (
    <div className={s.wrapper}>
      {gender === Gender.Man ? (
        <p className={s.selectedGender}>{forMan}</p>
      ) : (
        <Link href={'/productsList/' + Gender.Man}>
          <a>{forMan}</a>
        </Link>
      )}
      {gender === Gender.Woman ? (
        <p className={s.selectedGender}>{forWoman}</p>
      ) : (
        <Link href={'/productsList/' + Gender.Woman}>
          <a>{forWoman}</a>
        </Link>
      )}
    </div>
  );
};
