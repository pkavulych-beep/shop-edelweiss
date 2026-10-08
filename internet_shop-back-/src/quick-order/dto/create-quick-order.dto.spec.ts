import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateQuickOrderDto } from './create-quick-order.dto';

describe('CreateQuickOrderDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const validate = (body: object) =>
    pipe.transform(body, { type: 'body', metatype: CreateQuickOrderDto });

  const valid = { phoneNumber: '380991234567', productId: 7, size: 'M' };

  it.each(['380991234567', '+380991234567', '+38 (099) 123-45-67', '099 123 45 67', '0991234567', '991234567'])(
    'accepts valid phone %s',
    async phoneNumber => {
      await expect(validate({ ...valid, phoneNumber })).resolves.toEqual({ ...valid, phoneNumber });
    },
  );

  it('accepts a request without size', async () => {
    const { size: _size, ...body } = valid;
    await expect(validate(body)).resolves.toEqual(body);
  });

  it.each([
    ['without phone', { phoneNumber: undefined }],
    ['with empty phone', { phoneNumber: '' }],
    ['with a short phone', { phoneNumber: '099123456' }],
    ['with a non-Ukrainian phone', { phoneNumber: '+48 501 234 567' }],
    ['with too long phone', { phoneNumber: '3809912345678' }],
    ['with a non-string phone', { phoneNumber: 380991234567 }],
    ['with phone containing letters', { phoneNumber: '0671112233abc' }],
    ['without product', { productId: undefined }],
    ['with a non-integer product', { productId: 'abc' }],
    ['with too large productId', { productId: 99999999999 }],
    ['with empty size', { size: '' }],
    ['with a non-string size', { size: 42 }],
  ])('rejects a request %s', async (_name, patch) => {
    await expect(validate({ ...valid, ...patch })).rejects.toBeInstanceOf(BadRequestException);
  });
});
