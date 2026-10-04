import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import LogoutIcon from '@mui/icons-material/Logout';
import { MainLayout } from '../layouts/MainLayout';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { toLogOut, updateUserData } from '../redux/slices/auth-reducer';
import { useRouter } from 'next/router';
import Link from 'next/link';

type Tab = 'info' | 'orders' | 'addresses' | 'wishlist';

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { userData } = useAppSelector((state) => state.user);

  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [fullName, setFullName] = useState(userData?.fullName || '');
  const [phone, setPhone] = useState(userData?.phoneNumber || '');
  const [email, setEmail] = useState(userData?.email || '');
  const [saving, setSaving] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);

  useEffect(() => {
    if (userData) {
      setFullName(userData.fullName || '');
      setPhone(userData.phoneNumber || '');
      setEmail(userData.email || '');
    }
  }, [userData]);

  if (!userData) {
    return (
      <MainLayout title="Профіль">
        <Box sx={{ textAlign: 'center', py: 10, px: 3 }}>
          <PersonOutlineOutlinedIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h4" sx={{ fontSize: '1.25rem', mb: 1 }}>
            Увійдіть в акаунт
          </Typography>
          <Typography sx={{ color: 'text.secondary', mb: 4, fontSize: '0.9rem' }}>
            Щоб переглянути профіль, увійдіть або зареєструйтесь
          </Typography>
          <Button variant="contained" onClick={() => router.push('/')}>
            На головну
          </Button>
        </Box>
      </MainLayout>
    );
  }

  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSave = async () => {
    setSaving(true);
    await dispatch(updateUserData(userData.id, { fullName, phoneNumber: phone, email }));
    setSaving(false);
    setSnackOpen(true);
  };

  const handleLogout = () => {
    dispatch(toLogOut());
    router.push('/');
  };

  const menuItems = [
    { key: 'orders' as Tab, label: 'Мої замовлення', icon: <ShoppingBagOutlinedIcon /> },
    { key: 'info' as Tab, label: 'Особисті дані', icon: <PersonOutlineOutlinedIcon /> },
    { key: 'addresses' as Tab, label: 'Адреси', icon: <LocationOnOutlinedIcon /> },
    { key: 'wishlist' as Tab, label: 'Вподобане', icon: <FavoriteBorderIcon /> },
  ];

  return (
    <MainLayout title="Профіль">
      <Box
        sx={{
          maxWidth: 600,
          mx: 'auto',
          px: { xs: 2, md: 4 },
          py: { xs: 3, md: 6 },
        }}
      >
        {/* User header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
          <Avatar
            sx={{
              width: 56,
              height: 56,
              bgcolor: '#745c00',
              fontSize: '1.1rem',
              fontWeight: 700,
            }}
          >
            {initials}
          </Avatar>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
              {fullName}
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
              {email}
            </Typography>
          </Box>
        </Box>

        {/* Navigation menu */}
        <Box sx={{ mb: 4 }}>
          {menuItems.map((item) => (
            <ListItemButton
              key={item.key}
              selected={activeTab === item.key}
              onClick={() => setActiveTab(item.key)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                '&.Mui-selected': {
                  bgcolor: '#f2f4f4',
                  '&:hover': { bgcolor: '#eceeee' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: activeTab === item.key ? 'primary.main' : 'text.secondary' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: '0.85rem',
                  fontWeight: activeTab === item.key ? 700 : 500,
                }}
              />
            </ListItemButton>
          ))}
          <ListItemButton
            onClick={handleLogout}
            sx={{ borderRadius: 2, mt: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText
              primary="Вийти"
              primaryTypographyProps={{ fontSize: '0.85rem' }}
            />
          </ListItemButton>
        </Box>

        <Divider sx={{ mb: 4 }} />

        {/* Tab content */}
        {activeTab === 'info' && (
          <Box>
            <Typography
              sx={{
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'text.secondary',
                mb: 3,
              }}
            >
              Персональна інформація
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box>
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'text.secondary',
                    mb: 0.5,
                    letterSpacing: '0.05em',
                  }}
                >
                  Повне ім’я
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ваше ім'я"
                />
              </Box>

              <Box>
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'text.secondary',
                    mb: 0.5,
                    letterSpacing: '0.05em',
                  }}
                >
                  Електронна пошта
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </Box>

              <Box>
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'text.secondary',
                    mb: 0.5,
                    letterSpacing: '0.05em',
                  }}
                >
                  Номер телефону
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+38 (0__) ___-__-__"
                />
              </Box>

              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                sx={{ alignSelf: 'flex-start', px: 4, py: 1.2, mt: 1 }}
              >
                {saving ? 'Збереження...' : 'Зберегти зміни'}
              </Button>
            </Box>
          </Box>
        )}

        {activeTab === 'orders' && (
          <Box>
            <Typography
              sx={{
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'text.secondary',
                mb: 3,
              }}
            >
              Історія замовлень
            </Typography>
            <Box
              sx={{
                textAlign: 'center',
                py: 6,
                bgcolor: '#f2f4f4',
                borderRadius: 3,
              }}
            >
              <ShoppingBagOutlinedIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
                У вас ще немає замовлень
              </Typography>
              <Link href={`/productsList/woman`}>
                <a style={{ textDecoration: 'none' }}>
                  <Button variant="text" sx={{ mt: 2, color: 'primary.main' }}>
                    Перейти до каталогу
                  </Button>
                </a>
              </Link>
            </Box>
          </Box>
        )}

        {activeTab === 'addresses' && (
          <Box>
            <Typography
              sx={{
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'text.secondary',
                mb: 3,
              }}
            >
              Збережені адреси
            </Typography>
            <Box
              sx={{
                textAlign: 'center',
                py: 6,
                bgcolor: '#f2f4f4',
                borderRadius: 3,
              }}
            >
              <LocationOnOutlinedIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
                У вас ще немає збережених адрес
              </Typography>
            </Box>
          </Box>
        )}

        {activeTab === 'wishlist' && (
          <Box>
            <Typography
              sx={{
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'text.secondary',
                mb: 3,
              }}
            >
              Вподобане
            </Typography>
            <Box
              sx={{
                textAlign: 'center',
                py: 6,
                bgcolor: '#f2f4f4',
                borderRadius: 3,
              }}
            >
              <FavoriteBorderIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
                У вас ще немає вподобаних товарів
              </Typography>
              <Link href={`/productsList/woman`}>
                <a style={{ textDecoration: 'none' }}>
                  <Button variant="text" sx={{ mt: 2, color: 'primary.main' }}>
                    Перейти до каталогу
                  </Button>
                </a>
              </Link>
            </Box>
          </Box>
        )}
      </Box>

      <Snackbar
        open={snackOpen}
        autoHideDuration={3000}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackOpen(false)}
          severity="success"
          sx={{ width: '100%' }}
        >
          Дані успішно збережено
        </Alert>
      </Snackbar>
    </MainLayout>
  );
}
