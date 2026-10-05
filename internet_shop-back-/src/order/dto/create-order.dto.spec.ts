import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateOrderDto } from './create-order.dto';

describe('CreateOrderDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const validate = (body: object) =>
    pipe.transform(body, { type: 'body', metatype: CreateOrderDto });

  const valid = {
    productId: [1, 5],
    comment: 'Подзвоніть',
    cityName: 'Київ',
    department: 'Відділення №1',
  };

  it('keeps all order fields', async () => {
    await expect(validate({ ...valid, size: 'M' })).resolves.toEqual({
      ...valid,
      size: 'M',
    });
  });

  it('accepts an order without size and comment', async () => {
    const { comment: _comment, ...body } = valid;
    await expect(validate(body)).resolves.toEqual(body);
  });

  it.each([
    ['without products', { productId: [] }],
    ['with non-integer product ids', { productId: [1, 'abc'] }],
    ['with products not as a list', { productId: 1 }],
    ['without city', { cityName: undefined }],
    ['with empty city', { cityName: '' }],
    ['without department', { department: undefined }],
    ['with empty department', { department: '' }],
    ['with non-string size', { size: 42 }],
  ])('rejects an order %s', async (_name, patch) => {
    await expect(validate({ ...valid, ...patch })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
