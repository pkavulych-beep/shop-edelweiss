import { GetServerSideProps, NextPage } from 'next';
import { MainLayout } from '../layouts/MainLayout';

// Заготовка під міні-блог «новини і відгуки» (#154). Поки блогу немає, сторінку сховано: /news віддає 404.
export const getServerSideProps: GetServerSideProps = async () => ({ notFound: true });

export const News: NextPage = () => <MainLayout title={'новини і відгуки'}>{null}</MainLayout>;

export default News;
