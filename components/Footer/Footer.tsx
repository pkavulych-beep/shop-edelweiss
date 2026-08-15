import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { Gender } from '../../redux/Types/ProductType';

const footerLinks = {
  'Каталог': [
    { label: 'Жінкам', href: `/productsList/${Gender.Woman}` },
    { label: 'Чоловікам', href: `/productsList/${Gender.Man}` },
    { label: 'Нове', href: '/productsList/newProducts' },
    { label: 'Знижки', href: '/productsList/discounts' },
  ],
  'Інформація': [
    { label: 'Доставка та оплата', href: '/info' },
    { label: 'Обмін та повернення', href: '/info' },
  ],
  'Контакти': [
    { label: 'Instagram', href: '#' },
    { label: 'Telegram', href: '#' },
    { label: 'info@edelweiss.ua', href: 'mailto:info@edelweiss.ua' },
  ],
};

const Footer: React.FC = () => {
  return (
    <Box
      component="footer"
      sx={{
        bgcolor: '#eceeee',
        mt: 8,
        pt: { xs: 5, md: 8 },
        pb: 4,
        px: { xs: 3, md: 6 },
      }}
    >
      <Box
        sx={{
          maxWidth: 1440,
          mx: 'auto',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: '2fr repeat(3, 1fr)' },
          gap: { xs: 4, md: 6 },
          mb: 6,
        }}
      >
        {/* Brand */}
        <Box>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: '1.25rem',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              mb: 2,
            }}
          >
            Edelweiss
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 280, lineHeight: 1.7 }}>
            Вишуканий одяг для тих, хто цінує якість та стиль
          </Typography>
        </Box>

        {/* Link columns */}
        {Object.entries(footerLinks).map(([title, links]) => (
          <Box key={title}>
            <Typography
              variant="subtitle2"
              sx={{
                color: 'text.secondary',
                mb: 2,
              }}
            >
              {title}
            </Typography>
            {links.map((link) => (
              <Link key={link.label} href={link.href}>
                <a style={{ textDecoration: 'none' }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.primary',
                      mb: 1,
                      cursor: 'pointer',
                      transition: 'color 0.3s',
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    {link.label}
                  </Typography>
                </a>
              </Link>
            ))}
          </Box>
        ))}
      </Box>

      {/* Bottom bar */}
      <Box
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          pt: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', fontSize: '0.75rem' }}
        >
          &copy; {new Date().getFullYear()} Edelweiss. Всі права захищено.
        </Typography>
      </Box>
    </Box>
  );
};

export default Footer;
