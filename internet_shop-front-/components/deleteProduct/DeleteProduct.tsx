import { Button } from '@mui/material';
import Box from '@mui/material/Box';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import { useAppDispatch } from '../../redux/hooks';
import { deleteProduct } from '../../redux/slices/product-reducer';
import { useState } from 'react';
import Popup from '../Popup';

interface IDeleteProductProps {
  id: number | undefined;
}

export const DeleteProduct: NextPage<IDeleteProductProps> = ({ id }) => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleDelete = async () => {
    if (id == null) return;
    const { error } = await dispatch(deleteProduct(id));
    if (error) {
      console.error('Failed to delete product:', error);
      return;
    }
    router.push('/');
  };

  return (
    <>
      <Button variant='outlined' color='error' onClick={() => setIsConfirmOpen(true)}>
        Видалити товар
      </Button>

      <Popup
        open={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title='Видалити товар?'
        description='Цю дію неможливо скасувати. Товар буде видалений назавжди.'
      >
        <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'center' }}>
          <Button
            variant='outlined'
            onClick={() => setIsConfirmOpen(false)}
          >
            Скасувати
          </Button>
          <Button
            variant='contained'
            color='error'
            onClick={handleDelete}
          >
            Видалити
          </Button>
        </Box>
      </Popup>
    </>
  );
};
