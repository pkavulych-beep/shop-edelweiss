import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SyncCartDto } from './sync-cart.dto';

describe('SyncCartDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const validate = (body: object) => pipe.transform(body, { type: 'body', metatype: SyncCartDto });

  const valid = {
    items: [{ productId: 5, size: 'M', quantity: 2 }],
  };

  const messageOf = async (body: object) => {
    const response = await validate(body).catch((e: BadRequestException) => e.getResponse());
    return (response as { message: string[] }).message;
  };

  it('accepts a valid guest cart', async () => {
    await expect(validate(valid)).resolves.toEqual(valid);
  });

  it('accepts an item without a size', async () => {
    await expect(validate({ items: [{ productId: 5, quantity: 2 }] })).resolves.toEqual({
      items: [{ productId: 5, quantity: 2 }],
    });
  });

  it.each([
    ['zero', 0],
    ['a negative number', -1],
    ['a number above 100', 101],
    ['a fractional number', 1.5],
    ['a huge number', 21474836480],
    ['a string', '2'],
  ])('rejects %s as quantity', async (_name, quantity) => {
    await expect(
      validate({ items: [{ productId: 5, size: 'M', quantity }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects more than 100 items', async () => {
    const items = Array.from({ length: 101 }, (_, index) => ({
      productId: index + 1,
      size: 'M',
      quantity: 1,
    }));

    await expect(validate({ items })).rejects.toBeInstanceOf(BadRequestException);
    await expect(messageOf({ items })).resolves.toContain(
      'У кошику може бути не більше 100 позицій',
    );
  });

  it('accepts exactly 100 items', async () => {
    const items = Array.from({ length: 100 }, (_, index) => ({
      productId: index + 1,
      size: 'M',
      quantity: 1,
    }));

    await expect(validate({ items })).resolves.toEqual({ items });
  });

  it('reports the quantity bounds in Ukrainian', async () => {
    await expect(messageOf({ items: [{ productId: 5, quantity: 1.5 }] })).resolves.toEqual([
      'items.0.Кількість має бути цілим числом',
    ]);
    await expect(messageOf({ items: [{ productId: 5, quantity: 0 }] })).resolves.toEqual([
      'items.0.Кількість має бути не менше 1',
    ]);
    await expect(messageOf({ items: [{ productId: 5, quantity: 101 }] })).resolves.toEqual([
      'items.0.Кількість має бути не більше 100',
    ]);
  });
});
