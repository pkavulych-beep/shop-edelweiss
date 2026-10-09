import React, { Dispatch, SetStateAction } from 'react';
import { FC } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { PriceBox } from '../../PriceBox/PriceBox';
import { DeleteProduct } from '../../deleteProduct/DeleteProduct';
import { UpdateProduct } from '../../updateProduct/updateProduct';
import { AdminWrapper } from '../../adminWrapper/AdminWrapper';
import style from '../../../styles/Product.module.scss';

interface IProductInfo {
  id: number;
  name: string;
  sizes: string[];
  colors: string[];
  material: string;
  price: number;
  count: number;
  weight: string;
  description: string;
  salePrice: number;
  brand?: string;
  category?: string;
  season?: string;
  status?: string;
  selectedSize: number | string;
  setSelectedSize: Dispatch<SetStateAction<null | string>>;
}

const ProductInfo: FC<IProductInfo> = (props) => {
  const { name, price, salePrice, id, brand, count, status, ...infoDataProduct } = props;

  const sizes = Array.isArray(infoDataProduct.sizes)
    ? infoDataProduct.sizes
    : typeof infoDataProduct.sizes === 'string'
    ? (infoDataProduct.sizes as string).split(' ').filter((el) => el)
    : [];

  const hasSizes = sizes.length > 0;
  const isOutOfStock = status === 'out-of-stock' || (count !== undefined && count <= 0);

  return (
    <div className={style.info}>
      {brand && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            display: 'block',
            mb: 1,
          }}
        >
          {brand}
        </Typography>
      )}

      <Typography
        variant="h3"
        sx={{
          fontSize: { xs: '1.25rem', md: '1.5rem' },
          mb: 1,
          textAlign: 'center',
        }}
      >
        {name}
      </Typography>

      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', mb: 3, fontSize: '0.75rem' }}
      >
        Артикул: {id}
      </Typography>

      <PriceBox price={price} salePrice={salePrice} />

      {/* Out of stock indicator */}
      {isOutOfStock && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography
            variant="h6"
            sx={{
              color: 'error.main',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Немає в наявності
          </Typography>
        </Box>
      )}

      {/* Size selector */}
      {hasSizes && (
        <Box sx={{ mt: 3, width: '100%', textAlign: 'center' }}>
          <Typography
            variant="subtitle2"
            sx={{ color: 'text.secondary', mb: 1.5 }}
          >
            Розмір
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            {sizes.map((size) => (
              <Button
                key={size}
                variant="outlined"
                onClick={() => props.setSelectedSize(size)}
                sx={{
                  minWidth: 48,
                  height: 48,
                  borderColor: props.selectedSize === size ? 'primary.main' : 'rgba(175, 179, 179, 0.3)',
                  bgcolor: props.selectedSize === size ? 'primary.main' : 'transparent',
                  color: props.selectedSize === size ? 'primary.contrastText' : 'text.primary',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  boxShadow: props.selectedSize === size ? '0 2px 8px rgba(116, 92, 0, 0.3)' : 'none',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: props.selectedSize === size ? 'primary.main' : 'transparent',
                  },
                }}
              >
                {size}
              </Button>
            ))}
          </Box>
        </Box>
      )}

      <AdminWrapper>
        <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
          <DeleteProduct id={+id} />
          <UpdateProduct idProduct={+id} />
        </Box>
      </AdminWrapper>
    </div>
  );
};

export default ProductInfo;
