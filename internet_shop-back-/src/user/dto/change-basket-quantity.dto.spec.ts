import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ChangeBasketQuantityDto } from './change-basket-quantity.dto';

describe('ChangeBasketQuantityDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const validate = (body: object) =>
    pipe.transform(body, { type: 'body', metatype: ChangeBasketQuantityDto });

  const valid = {
    idProduct: 5,
    size: 'M',
    quantity: 2,
  };

  const messageOf = async (body: object) => {
    const response = await validate(body).catch((e: BadRequestException) =>
      e.getResponse(),
    );
    return (response as { message: string[] }).message;
  };

  it('accepts a valid quantity change', async () => {
    await expect(validate(valid)).resolves.toEqual(valid);
  });

  it('accepts a product without a size', async () => {
    await expect(
      validate({ idProduct: 5, quantity: 2 }),
    ).resolves.toEqual({ idProduct: 5, quantity: 2 });
  });

  it.each([
    ['zero', 0],
    ['a negative number', -1],
    ['a number above 100', 101],
    ['a fractional number', 1.5],
    ['a string', '2'],
  ])('rejects %s as quantity', async (_name, quantity) => {
    await expect(validate({ ...valid, quantity })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each([
    ['without a product', { idProduct: undefined }],
    ['without a quantity', { quantity: undefined }],
  ])('rejects a change %s', async (_name, patch) => {
    await expect(validate({ ...valid, ...patch })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reports the quantity bounds in Ukrainian', async () => {
    await expect(messageOf({ ...valid, quantity: 0 })).resolves.toEqual([
      'Кількість має бути не меншою за 1',
    ]);
    await expect(messageOf({ ...valid, quantity: 101 })).resolves.toEqual([
      'Кількість має бути не більшою за 100',
    ]);
  });
});
