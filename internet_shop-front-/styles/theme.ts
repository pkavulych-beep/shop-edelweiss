import { createTheme, ThemeOptions } from '@mui/material/styles';
import { ukUA } from '@mui/material/locale';

declare module '@mui/material/styles' {
  interface Theme {
    custom: {
      glass: string;
      glassBlur: string;
      surfaceContainer: string;
      surfaceContainerLow: string;
      surfaceContainerHigh: string;
      onSurfaceVariant: string;
      outlineVariant: string;
      primaryContainer: string;
    };
  }
  interface ThemeOptions {
    custom?: {
      glass?: string;
      glassBlur?: string;
      surfaceContainer?: string;
      surfaceContainerLow?: string;
      surfaceContainerHigh?: string;
      onSurfaceVariant?: string;
      outlineVariant?: string;
      primaryContainer?: string;
    };
  }
}

const themeOptions: ThemeOptions = {
  custom: {
    glass: 'rgba(249, 249, 249, 0.85)',
    glassBlur: 'blur(12px)',
    surfaceContainer: '#eceeee',
    surfaceContainerLow: '#f2f4f4',
    surfaceContainerHigh: '#e6e9e9',
    onSurfaceVariant: '#5b6061',
    outlineVariant: '#afb3b3',
    primaryContainer: '#f9d461',
  },
  palette: {
    primary: {
      main: '#745c00',
      contrastText: '#fff8ee',
    },
    secondary: {
      main: '#5f5f5f',
      contrastText: '#fbf8f8',
    },
    error: {
      main: '#a73b21',
    },
    background: {
      default: '#f9f9f9',
      paper: '#ffffff',
    },
    text: {
      primary: '#2f3334',
      secondary: '#5b6061',
    },
  },
  typography: {
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h1: {
      fontWeight: 700,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.2em',
      fontSize: '3rem',
    },
    h2: {
      fontWeight: 700,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.15em',
      fontSize: '2.25rem',
    },
    h3: {
      fontWeight: 700,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.1em',
      fontSize: '1.875rem',
    },
    h4: {
      fontWeight: 700,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.1em',
      fontSize: '1.5rem',
    },
    h5: {
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.1em',
      fontSize: '1.25rem',
    },
    h6: {
      fontWeight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      fontSize: '1rem',
    },
    subtitle1: {
      fontWeight: 500,
      letterSpacing: '0.05em',
      fontSize: '1rem',
    },
    subtitle2: {
      fontWeight: 700,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.2em',
      fontSize: '0.75rem',
    },
    body1: {
      fontWeight: 400,
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontWeight: 400,
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      fontWeight: 700,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.15em',
      fontSize: '0.8125rem',
    },
    caption: {
      fontWeight: 700,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.2em',
      fontSize: '0.625rem',
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f9f9f9',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 4,
          padding: '12px 32px',
          fontWeight: 700,
          letterSpacing: '0.15em',
          transition: 'all 0.3s ease',
          '&:hover': {
            opacity: 0.9,
          },
          '&:active': {
            transform: 'scale(0.95)',
          },
        },
        containedPrimary: {
          backgroundColor: '#745c00',
          color: '#fff8ee',
          '&:hover': {
            backgroundColor: '#5a4700',
          },
        },
        outlined: {
          borderColor: 'rgba(175, 179, 179, 0.3)',
          color: '#2f3334',
          '&:hover': {
            backgroundColor: '#eceeee',
            borderColor: 'rgba(175, 179, 179, 0.5)',
          },
        },
        text: {
          color: '#745c00',
          '&:hover': {
            backgroundColor: 'transparent',
            opacity: 0.8,
          },
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: 'transparent',
          border: 'none',
          boxShadow: 'none',
          transition: 'transform 0.3s ease',
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(249, 249, 249, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: '#2f3334',
          borderBottom: 'none',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#e6e9e9',
            borderRadius: 8,
            '& fieldset': {
              border: 'none',
            },
            '&:hover fieldset': {
              border: 'none',
            },
            '&.Mui-focused fieldset': {
              border: '1px solid #745c00',
            },
            '&.Mui-focused': {
              backgroundColor: '#ffffff',
            },
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#e6e9e9',
          borderRadius: 8,
          '& .MuiOutlinedInput-notchedOutline': {
            border: 'none',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            border: 'none',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            border: '1px solid #745c00',
          },
          '&.Mui-focused': {
            backgroundColor: '#ffffff',
          },
        },
      },
    },
    MuiPagination: {
      styleOverrides: {
        root: {
          '& .MuiPaginationItem-root': {
            color: '#5b6061',
            fontWeight: 600,
            letterSpacing: '0.05em',
            '&:hover': {
              backgroundColor: '#eceeee',
            },
          },
          '& .Mui-selected': {
            backgroundColor: '#745c00 !important',
            color: '#fff8ee !important',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 600,
          letterSpacing: '0.05em',
          fontSize: '0.75rem',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: '0px 24px 48px rgba(47, 51, 52, 0.06)',
        },
      },
    },
    MuiAccordion: {
      defaultProps: {
        elevation: 0,
        disableGutters: true,
      },
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          '&:before': {
            display: 'none',
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          padding: '0',
          minHeight: 'auto',
          '&.Mui-expanded': {
            minHeight: 'auto',
          },
        },
        content: {
          margin: '12px 0',
          '&.Mui-expanded': {
            margin: '12px 0',
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': {
            color: '#745c00',
          },
          '&.Mui-checked + .MuiSwitch-track': {
            backgroundColor: '#f9d461',
          },
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontWeight: 700,
          fontSize: '0.65rem',
          letterSpacing: '0.05em',
        },
      },
    },
  },
};

export const theme = createTheme(themeOptions, ukUA);
