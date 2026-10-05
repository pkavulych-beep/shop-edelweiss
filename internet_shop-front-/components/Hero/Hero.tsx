import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Link from 'next/link';
import { Gender } from '../../redux/Types/ProductType';

const Hero: React.FC = () => {
  return (
    <Box
      sx={{
        position: 'relative',
        height: { xs: '70vh', md: '90vh' },
        minHeight: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        overflow: 'hidden',
        bgcolor: '#2a2f2f',
      }}
    >
      {/* Background image */}
      <Box
        component="img"
        src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920&q=80&fit=crop"
        alt=""
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center 30%',
          zIndex: 0,
        }}
      />

      {/* Dark overlay for readability */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.5) 100%)',
          zIndex: 1,
        }}
      />

      {/* Decorative large text */}
      <Typography
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontFamily: "'Georgia', serif",
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: { xs: '4rem', md: '10rem' },
          color: 'rgba(255,255,255,0.06)',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          zIndex: 1,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        Сезонна колекція
      </Typography>

      {/* Content */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          px: 3,
          maxWidth: 800,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            color: 'rgba(255,255,255,0.7)',
            mb: 2,
            letterSpacing: '0.4em',
          }}
        >
          Нова колекція 2026
        </Typography>
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: '2rem', md: '3.5rem' },
            color: '#fff',
            mb: 3,
            lineHeight: 1.1,
            textShadow: '0 2px 20px rgba(0,0,0,0.3)',
          }}
        >
          Вишуканість у кожній деталі
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: 'rgba(255,255,255,0.8)',
            mb: 5,
            maxWidth: 500,
            mx: 'auto',
            fontSize: { xs: '0.9rem', md: '1rem' },
          }}
        >
          Відкрийте для себе ексклюзивну колекцію від Edelweiss
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href={`/productsList/${Gender.Woman}`}>
            <a style={{ textDecoration: 'none' }}>
              <Button
                variant="contained"
                sx={{
                  minWidth: 180,
                  py: 1.5,
                  bgcolor: '#fff',
                  color: '#2f3334',
                  fontWeight: 700,
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.9)',
                  },
                }}
              >
                Жінкам
              </Button>
            </a>
          </Link>
          <Link href={`/productsList/${Gender.Man}`}>
            <a style={{ textDecoration: 'none' }}>
              <Button
                variant="outlined"
                sx={{
                  minWidth: 180,
                  py: 1.5,
                  borderColor: 'rgba(255,255,255,0.6)',
                  color: '#fff',
                  '&:hover': {
                    borderColor: '#fff',
                    bgcolor: 'rgba(255,255,255,0.1)',
                  },
                }}
              >
                Чоловікам
              </Button>
            </a>
          </Link>
        </Box>
      </Box>
    </Box>
  );
};

export default Hero;
