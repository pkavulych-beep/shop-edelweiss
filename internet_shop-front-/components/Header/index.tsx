import * as React from 'react';
import { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Typography from '@mui/material/Typography';
import useScrollTrigger from '@mui/material/useScrollTrigger';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import Drawer from '@mui/material/Drawer';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAppSelector } from '../../redux/hooks';
import { Gender } from '../../redux/Types/ProductType';
import { DialogLogin } from './DialogAuth/DialogLogin';
import { DialogRegister } from './DialogAuth/DialogRegister';
import { MenuProfile } from './iconGroup/menuProfile/MenuProfile';

const navLinks = [
  { label: 'Жінкам', href: `/productsList/${Gender.Woman}` },
  { label: 'Чоловікам', href: `/productsList/${Gender.Man}` },
  { label: 'Нове', href: '/productsList/newProducts' },
  { label: 'Знижки', href: '/productsList/discounts' },
];

export default function Header() {
  const router = useRouter();
  const { userData } = useAppSelector((store) => store.user);
  const cartCount = useAppSelector((store) => store.cart.data?.length ?? 0);

  const [dialogLoginOpen, setDialogLogin] = useState(false);
  const [dialogRegisterOpen, setDialogRegister] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const profileMenuOpen = Boolean(anchorEl);

  const handleProfileClick = (event: React.MouseEvent<HTMLElement>) => {
    if (userData === null) {
      setDialogLogin(true);
    } else {
      setAnchorEl(event.currentTarget);
    }
  };

  const scrolled = useScrollTrigger({
    disableHysteresis: true,
    threshold: 50,
  });

  const isActive = (href: string) => router.asPath.startsWith(href);

  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          bgcolor: scrolled ? 'rgba(249,249,249,0.95)' : 'rgba(249,249,249,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: 'text.primary',
          height: 80,
          justifyContent: 'center',
          transition: 'background-color 0.3s ease',
          zIndex: 1300,
          boxShadow: scrolled ? '0 1px 0 rgba(0,0,0,0.04)' : 'none',
        }}
      >
        <Toolbar
          sx={{
            px: { xs: 2, md: 6 },
            justifyContent: 'space-between',
            position: 'relative',
          }}
        >
          {/* Left: Navigation (desktop) / Burger (mobile) */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flex: 1,
            }}
          >
            {/* Mobile burger */}
            <IconButton
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              sx={{
                display: { xs: 'flex', md: 'none' },
                color: 'text.primary',
              }}
            >
              <MenuIcon />
            </IconButton>

            {/* Desktop nav */}
            <Box
              sx={{
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                gap: 4,
              }}
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    textDecoration: 'none',
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontSize: '0.7rem',
                      letterSpacing: '0.15em',
                      color: isActive(link.href) ? 'primary.main' : 'text.secondary',
                      borderBottom: isActive(link.href) ? '2px solid' : '2px solid transparent',
                      borderColor: isActive(link.href) ? 'primary.main' : 'transparent',
                      pb: 0.5,
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      '&:hover': {
                        color: 'primary.main',
                      },
                    }}
                  >
                    {link.label}
                  </Typography>
                </Link>
              ))}
            </Box>
          </Box>

          {/* Center: Logo */}
          <Link
            href="/"
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              textDecoration: 'none',
            }}
          >
            <Typography
              sx={{
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 800,
                fontSize: { xs: '0.75rem', sm: '1rem', md: '1.4rem' },
                letterSpacing: { xs: '0.12em', sm: '0.2em', md: '0.25em' },
                textTransform: 'uppercase',
                color: 'text.primary',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Edelweiss
            </Typography>
          </Link>

          {/* Right: Icons */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 0.5, md: 1 },
              flex: 1,
              justifyContent: 'flex-end',
            }}
          >
            {/* Profile — desktop only */}
            <IconButton
              onClick={handleProfileClick}
              sx={{
                display: { xs: 'none', md: 'flex' },
                color: 'text.primary',
                '&:hover': { color: 'primary.main' },
                transition: 'color 0.3s',
              }}
            >
              <PersonOutlineOutlinedIcon />
            </IconButton>

            <Link href="/cart">
              <IconButton
                sx={{
                  color: 'text.primary',
                  '&:hover': { color: 'primary.main' },
                  transition: 'color 0.3s',
                }}
              >
                <Badge
                  badgeContent={cartCount}
                  sx={{
                    '& .MuiBadge-badge': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      fontSize: '0.6rem',
                      minWidth: 18,
                      height: 18,
                    },
                  }}
                >
                  <ShoppingBagOutlinedIcon />
                </Badge>
              </IconButton>
            </Link>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Navigation Drawer */}
      <Drawer
        anchor="left"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        PaperProps={{
          sx: {
            width: '100%',
            maxWidth: 360,
            bgcolor: 'background.default',
            pt: 2,
          },
        }}
      >
        <Box sx={{ px: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: '1.2rem',
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
              }}
            >
              Edelweiss
            </Typography>
            <IconButton onClick={() => setMobileMenuOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              style={{ textDecoration: 'none' }}
            >
              <Typography
                sx={{
                  py: 2,
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: isActive(link.href) ? 'primary.main' : 'text.primary',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  cursor: 'pointer',
                }}
              >
                {link.label}
              </Typography>
            </Link>
          ))}
        </Box>
      </Drawer>

      {/* Auth Dialogs */}
      <DialogLogin
        open={dialogLoginOpen}
        setLogin={setDialogLogin}
        setRegister={setDialogRegister}
      />
      <DialogRegister
        open={dialogRegisterOpen}
        setRegister={setDialogRegister}
        setLogin={setDialogLogin}
      />
      <MenuProfile
        anchorEl={anchorEl}
        open={profileMenuOpen}
        onClose={() => setAnchorEl(null)}
        onClick={() => setAnchorEl(null)}
      />
    </>
  );
}
