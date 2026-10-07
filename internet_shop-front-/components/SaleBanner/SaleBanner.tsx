import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Link from 'next/link';

const SaleBanner: React.FC = () => {
  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: '#1a1a1a',
        color: '#fff',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          maxWidth: 1440,
          mx: 'auto',
          px: { xs: 3, md: 6 },
          py: { xs: 8, md: 12 },
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
          <Typography
            sx={{
              fontSize: { xs: '0.65rem', md: '0.7rem' },
              fontWeight: 700,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)',
              mb: 2,
            }}
          >
            Спеціальна пропозиція
          </Typography>
          <Typography
            sx={{
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 800,
              fontSize: { xs: '2.5rem', md: '4rem' },
              lineHeight: 1,
              letterSpacing: '-0.02em',
              mb: 2,
            }}
          >
            ЗНИЖКИ ДО 40%
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: '0.9rem', md: '1rem' },
              color: 'rgba(255,255,255,0.6)',
              mb: 4,
              maxWidth: 400,
              mx: { xs: 'auto', md: 0 },
            }}
          >
            Встигніть придбати улюблені речі за найкращими цінами
          </Typography>
          <Link href="/productsList/discounts" style={{ textDecoration: 'none' }}>
            <Button
              variant="contained"
              sx={{
                bgcolor: '#f9d461',
                color: '#1a1a1a',
                px: 5,
                py: 1.5,
                fontWeight: 700,
                '&:hover': {
                  bgcolor: '#e6c250',
                },
              }}
            >
              Переглянути
            </Button>
          </Link>
        </Box>

        {/* Decorative SALE text */}
        <Typography
          sx={{
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 900,
            fontSize: { xs: '6rem', md: '10rem' },
            lineHeight: 1,
            color: 'rgba(255,255,255,0.04)',
            letterSpacing: '-0.02em',
            userSelect: 'none',
            display: { xs: 'none', md: 'block' },
          }}
        >
          SALE
        </Typography>
      </Box>

      {/* Gradient accent */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '50%',
          height: '100%',
          background: 'linear-gradient(135deg, transparent 0%, rgba(249,212,97,0.06) 100%)',
          zIndex: 0,
        }}
      />
    </Box>
  );
};

export default SaleBanner;
