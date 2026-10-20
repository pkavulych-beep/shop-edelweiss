import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateOrderDto } from './create-order.dto';
import { PaymentMethod } from '../paymentEnum';
import { DeliveryMethod } from '../deliveryEnum';

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

  it('accepts an order without size in an item', async () => {
    const body = {
      ...valid,
      items: [{ productId: 1, quantity: 2 }],
    };
    const result = await validate(body);
    expect(result.items[0].size).toBeUndefined();
    expect(result.items[0].productId).toBe(1);
    expect(result.items[0].quantity).toBe(2);
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

  it.each([PaymentMethod.Cod, PaymentMethod.Card])(
    'accepts payment method %s',
    async method => {
      const result = await validate({ ...valid, paymentMethod: method });
      expect(result.paymentMethod).toBe(method);
    },
  );

  it('leaves the default payment method to the backend', async () => {
    const result = await validate(valid);
    expect(result.paymentMethod).toBeUndefined();
  });

  it.each([
    ['Nova Poshta', DeliveryMethod.NovaPoshta, 'Відділення №1'],
    ['Ukrposhta', DeliveryMethod.Ukrposhta, '79000'],
    ['Meest', DeliveryMethod.Meest, 'Відділення №1'],
  ])('accepts %s as the delivery method', async (_name, method, department) => {
    const result = await validate({ ...valid, deliveryMethod: method, department });
    expect(result.deliveryMethod).toBe(method);
    expect(result.department).toBe(department);
  });

  it('leaves the default delivery method to the backend', async () => {
    const result = await validate(valid);
    expect(result.deliveryMethod).toBeUndefined();
  });

  it.each([
    ['a too short index', '7900'],
    ['an index with a letter', '79000a'],
    ['a department name instead of an index', 'Відділення 1'],
    ['a missing department', undefined],
  ])('rejects Ukrposhta with %s', async (_name, department) => {
    await expect(
      validate({ ...valid, deliveryMethod: DeliveryMethod.Ukrposhta, department }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('drops payment status fields a client must not set', async () => {
    const result = await validate({
      ...valid,
      paymentStatus: 'PAID',
      paymentInvoiceId: 'inv-1',
      paidAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result).toEqual(valid);
  });

  it.each([
    ['without items', { items: [] }],
    ['with items not as a list', { items: item }],
    ['with non-integer product id', { items: [{ ...item, productId: 'abc' }] }],
    ['with a product id bigger than PostgreSQL integer', { items: [{ ...item, productId: 99999999999 }] }],
    ['with a negative product id bigger than PostgreSQL integer', { items: [{ ...item, productId: -99999999999 }] }],
    ['with zero product id', { items: [{ ...item, productId: 0 }] }],
    ['with zero quantity', { items: [{ ...item, quantity: 0 }] }],
    ['with fractional quantity', { items: [{ ...item, quantity: 1.5 }] }],
    ['with too big quantity', { items: [{ ...item, quantity: 101 }] }],
    ['without city', { cityName: undefined }],
    ['with empty city', { cityName: '' }],
    ['without department', { department: undefined }],
    ['with empty department', { department: '' }],
    ['with an unknown payment method', { paymentMethod: 'CASH' }],
    ['with an unknown delivery method', { deliveryMethod: 'DHL' }],
  ])('rejects an order %s', async (_name, patch) => {
    await expect(validate({ ...valid, ...patch })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
