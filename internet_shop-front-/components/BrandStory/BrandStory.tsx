import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const BrandStory: React.FC = () => {
  return (
    <Box
      sx={{
        bgcolor: '#f2f4f4',
        py: { xs: 6, md: 10 },
        px: { xs: 3, md: 6 },
      }}
    >
      <Box
        sx={{
          maxWidth: 800,
          mx: 'auto',
          textAlign: 'center',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            color: 'text.secondary',
            mb: 2,
          }}
        >
          Наша філософія
        </Typography>
        <Typography
          variant="h3"
          sx={{
            fontSize: { xs: '1.25rem', md: '1.875rem' },
            mb: 3,
          }}
        >
          Мистецтво елегантності
        </Typography>
        <Typography
          sx={{
            color: 'text.secondary',
            lineHeight: 1.9,
            fontSize: { xs: '0.875rem', md: '1rem' },
            maxWidth: 600,
            mx: 'auto',
          }}
        >
          Edelweiss — це більше, ніж одяг. Це мистецтво поєднання сучасних
          трендів з позачасовою елегантністю. Кожна річ у нашій колекції створена
          з увагою до деталей, натуральних матеріалів та бездоганної якості.
        </Typography>
      </Box>
    </Box>
  );
};

export default BrandStory;
