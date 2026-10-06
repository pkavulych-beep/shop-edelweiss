import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateOrderDto } from './create-order.dto';

describe('CreateOrderDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const validate = (body: object) =>
    pipe.transform(body, { type: 'body', metatype: CreateOrderDto });

  const item = { productId: 1, size: 'M', quantity: 2 };
  const valid = {
    items: [item, { productId: 5, size: 'L', quantity: 1 }],
    comment: 'Подзвоніть',
    cityName: 'Київ',
    department: 'Відділення №1',
  };

  it('keeps all order fields', async () => {
    await expect(validate(valid)).resolves.toEqual(valid);
  });

  it('accepts an order without comment', async () => {
    const { comment: _comment, ...body } = valid;
    await expect(validate(body)).resolves.toEqual(body);
  });

  it('drops a client-side price', async () => {
    const result = await validate({
      ...valid,
      items: [{ ...item, price: 1 }],
      total: 1,
    });
    expect(result).toEqual({ ...valid, items: [item] });
  });

  it.each([
    ['without items', { items: [] }],
    ['with items not as a list', { items: item }],
    ['with non-integer product id', { items: [{ ...item, productId: 'abc' }] }],
    ['without size', { items: [{ ...item, size: undefined }] }],
    ['with empty size', { items: [{ ...item, size: '' }] }],
    ['with zero quantity', { items: [{ ...item, quantity: 0 }] }],
    ['with fractional quantity', { items: [{ ...item, quantity: 1.5 }] }],
    ['with too big quantity', { items: [{ ...item, quantity: 101 }] }],
    ['without city', { cityName: undefined }],
    ['with empty city', { cityName: '' }],
    ['without department', { department: undefined }],
    ['with empty department', { department: '' }],
  ])('rejects an order %s', async (_name, patch) => {
    await expect(validate({ ...valid, ...patch })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
