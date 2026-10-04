import Modal from '@mui/material/Modal';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { ReactNode } from 'react';

export default function Popup({ open, onClose, title, description, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 380 },
          bgcolor: '#ffffff',
          borderRadius: 3,
          boxShadow: '0px 24px 48px rgba(47, 51, 52, 0.06)',
          p: { xs: 3, sm: 4 },
          outline: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {children ? (
          // Rich modal with children (e.g. cart confirmation)
          <>
            {title && (
              <Typography
                variant="h4"
                sx={{
                  fontSize: '1.15rem',
                  textAlign: 'center',
                  mb: description ? 1 : 0,
                  letterSpacing: '0.05em',
                }}
              >
                {title}
              </Typography>
            )}
            {description && (
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', textAlign: 'center', mb: 2 }}
              >
                {description}
              </Typography>
            )}
            {children}
          </>
        ) : (
          // Simple modal (just title + description)
          <>
            <Typography
              variant="h4"
              sx={{
                fontSize: '1.15rem',
                textAlign: 'center',
                mb: 1,
                letterSpacing: '0.05em',
              }}
            >
              {title}
            </Typography>
            {description && (
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', textAlign: 'center', lineHeight: 1.6 }}
              >
                {description}
              </Typography>
            )}
          </>
        )}
      </Box>
    </Modal>
  );
}
