import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import Link from 'next/link';
import { useRouter } from 'next/router';

const navItems = [
  { label: 'Головна', icon: HomeOutlinedIcon, href: '/' },
  { label: 'Каталог', icon: GridViewOutlinedIcon, href: '/productsList/woman' },
  { label: 'Профіль', icon: PersonOutlineOutlinedIcon, href: '/profile' },
];

const BottomNav: React.FC = () => {
  const router = useRouter();

  return (
    <Box
      sx={{
        display: { xs: 'flex', md: 'none' },
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        bgcolor: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        justifyContent: 'space-around',
        alignItems: 'center',
        py: 1,
        pb: 'calc(8px + env(safe-area-inset-bottom))',
      }}
    >
      {navItems.map((item) => {
        const isActive =
          item.href === '/'
            ? router.pathname === '/'
            : router.pathname.startsWith(item.href.replace(/\/[^/]+$/, ''));
        const Icon = item.icon;

        return (
          <Link key={item.label} href={item.href} style={{ textDecoration: 'none' }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.3,
                minWidth: 64,
                color: isActive ? 'primary.main' : 'text.secondary',
                transition: 'color 0.2s',
              }}
            >
              <Icon sx={{ fontSize: 22 }} />
              <Typography
                sx={{
                  fontSize: '0.6rem',
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: '0.05em',
                }}
              >
                {item.label}
              </Typography>
            </Box>
          </Link>
        );
      })}
    </Box>
  );
};

export default BottomNav;
