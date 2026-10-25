import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateProductDto } from './create-product.dto';
import { Gender } from '../entities/product.entity';

describe('CreateProductDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const validate = (body: object) =>
    pipe.transform(body, { type: 'body', metatype: CreateProductDto });

  const messageOf = async (body: object) => {
    const response = await validate(body).catch((e: BadRequestException) =>
      e.getResponse(),
    );
    return (response as { message: string[] }).message;
  };

  const valid = {
    name: 'Куртка',
    description: 'Тепла куртка для зимових прогулянок містом',
    gender: Gender.Man,
    price: 1000,
  };

  it('accepts the product data unchanged', async () => {
    await expect(validate(valid)).resolves.toEqual(valid);
  });

  it('reads numbers sent through FormData as strings', async () => {
    await expect(
      validate({ ...valid, price: '1000', count: '5', salePrice: '800' }),
    ).resolves.toEqual({
      ...valid,
      price: 1000,
      count: 5,
      salePrice: 800,
    });
  });

  const invalid: [string, unknown, string][] = [
    ['price', 'abc', 'Ціна має бути цілим числом'],
    ['price', 10.5, 'Ціна має бути цілим числом'],
    ['count', 'багато', 'Кількість має бути цілим числом'],
    ['count', 2.5, 'Кількість має бути цілим числом'],
    ['salePrice', 'знижка', 'Ціна зі знижкою має бути цілим числом'],
  ];

  it.each(invalid)('rejects %s = %s', async (field, value, message) => {
    await expect(messageOf({ ...valid, [field]: value })).resolves.toEqual([
      message,
    ]);
  });

  it('reports a missing price in Ukrainian', async () => {
    const { price, ...withoutPrice } = valid;
    await expect(messageOf(withoutPrice)).resolves.toContain('Вкажіть ціну');
  });
});
