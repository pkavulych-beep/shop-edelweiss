import React, { FC } from 'react';
import Head from 'next/head';
import Box from '@mui/material/Box';
import Header from '../components/Header';
import Footer from '../components/Footer/Footer';
import BottomNav from '../components/BottomNav/BottomNav';

interface IMainLayoutProps {
  title?: string;
  children: React.ReactNode;
}

export const MainLayout: FC<IMainLayoutProps> = ({ children, title = 'Edelweiss' }) => {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Edelweiss — вишуканий одяг для тих, хто цінує якість та стиль" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Header />
      <Box
        component="main"
        sx={{
          pt: '80px',
          pb: { xs: '72px', md: 0 },
          minHeight: '100vh',
        }}
      >
        {children}
      </Box>
      <Footer />
      <BottomNav />
    </>
  );
};
