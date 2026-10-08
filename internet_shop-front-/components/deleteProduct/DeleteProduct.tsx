import { Button } from '@mui/material';
import Box from '@mui/material/Box';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import { Api } from '../../api/Api';
import { useAppDispatch } from '../../redux/hooks';
import { removeProduct } from '../../redux/slices/product-reducer';
import { useState } from 'react';
import Popup from '../Popup';

interface IDeleteProductProps {
  id: number | undefined;
}

export const DeleteProduct: NextPage<IDeleteProductProps> = ({ id }) => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const deleteProduct = async () => {
    try {
      await Api().product.deleteById(id);
      dispatch(removeProduct(id));
      router.push('/');
    } catch (e) {
      console.error('Failed to delete product:', e);
    }
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
            onClick={deleteProduct}
          >
            Видалити
          </Button>
        </Box>
      </Popup>
    </>
  );
};
