import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { Gender } from '../../redux/Types/ProductType';

interface CategoryItem {
  title: string;
  href: string;
  image: string;
}

const featured: CategoryItem = {
  title: 'Верхній одяг',
  href: `/productsList/${Gender.Man}?category=outerwear`,
  image: 'https://images.unsplash.com/photo-1608063615781-e2ef8c73d114?w=1200&q=80&fit=crop',
};

const secondary: CategoryItem[] = [
  {
    title: 'Штани',
    href: `/productsList/${Gender.Man}?category=pants`,
    image: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600&q=80&fit=crop',
  },
  {
    title: 'Худі',
    href: `/productsList/${Gender.Man}?category=hoodies`,
    image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&q=80&fit=crop',
  },
];

const CategoryCard: React.FC<{ item: CategoryItem; height: { xs: number; md: number } }> = ({
  item,
  height,
}) => (
  <Link href={item.href} style={{ textDecoration: 'none', display: 'block' }}>
    <Box
      sx={{
        position: 'relative',
        borderRadius: 3,
        overflow: 'hidden',
        height,
        cursor: 'pointer',
        '&:hover img': {
          transform: 'scale(1.05)',
        },
      }}
    >
      <Box
        component="img"
        src={item.image}
        alt={item.title}
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transition: 'transform 0.6s ease',
        }}
      />
      {/* Overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)',
        }}
      />
      {/* Label */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          sx={{
            color: '#fff',
            fontWeight: 800,
            fontSize: { xs: '1.1rem', md: '1.4rem' },
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {item.title}
        </Typography>
      </Box>
    </Box>
  </Link>
);

const CategoryCards: React.FC = () => {
  return (
    <Box
      sx={{
        maxWidth: 1440,
        mx: 'auto',
        px: { xs: 2, md: 6 },
        py: { xs: 4, md: 8 },
      }}
    >
      <Typography
        variant="h3"
        sx={{
          fontSize: { xs: '1.25rem', md: '1.875rem' },
          mb: { xs: 2, md: 4 },
        }}
      >
        Категорії
      </Typography>

      {/* Featured — full width */}
      <Box sx={{ mb: { xs: 1.5, md: 3 } }}>
        <CategoryCard item={featured} height={{ xs: 220, md: 380 }} />
      </Box>

      {/* Two smaller cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: { xs: 1.5, md: 3 },
        }}
      >
        {secondary.map((cat) => (
          <CategoryCard key={cat.title} item={cat} height={{ xs: 200, md: 320 }} />
        ))}
      </Box>
    </Box>
  );
};

export default CategoryCards;
