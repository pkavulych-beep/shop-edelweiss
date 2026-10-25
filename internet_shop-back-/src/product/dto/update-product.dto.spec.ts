import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateProductDto } from './update-product.dto';
import { Gender } from '../entities/product.entity';

// PartialType з @nestjs/mapped-types має успадковувати правила CreateProductDto
describe('UpdateProductDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const validate = (body: object) =>
    pipe.transform(body, { type: 'body', metatype: UpdateProductDto });

  it('accepts a partial update', async () => {
    await expect(validate({ price: 100 })).resolves.toEqual({ price: 100 });
  });

  it('accepts an empty update', async () => {
    await expect(validate({})).resolves.toEqual({});
  });

  it('keeps inherited transforms', async () => {
    await expect(validate({ sizes: 'S, M', gender: Gender.Man })).resolves.toEqual({
      sizes: ['S', 'M'],
      gender: Gender.Man,
    });
  });

  it('drops unknown fields', async () => {
    await expect(validate({ name: 'Куртка', id: 1 })).resolves.toEqual({ name: 'Куртка' });
  });

  it('rejects an invalid inherited field', async () => {
    await expect(validate({ gender: 'robot' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
