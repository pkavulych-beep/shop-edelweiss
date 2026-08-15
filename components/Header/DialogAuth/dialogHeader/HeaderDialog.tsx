import { FC } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

interface IDialogHeaderProps {
  text: string;
  handleClose(): void;
}

export const DialogHeader: FC<IDialogHeaderProps> = ({ text, handleClose }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 3,
        pt: 3,
        pb: 1,
      }}
    >
      <Typography
        variant="h4"
        sx={{ fontSize: '1.25rem' }}
      >
        {text}
      </Typography>
      <IconButton
        onClick={handleClose}
        size="small"
        sx={{
          color: 'text.secondary',
          '&:hover': { color: 'text.primary' },
        }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};
