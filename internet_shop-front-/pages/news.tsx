import { NextPage } from 'next';
import { MainLayout } from '../layouts/MainLayout';
import { EmptyCart } from '../components/cartComponents/emptyCart/EmptyCart';

export const News: NextPage = () => {
  return (
    <MainLayout title={'новини і відгуки'}>
      <EmptyCart />
    </MainLayout>
  );
};

export default News;
