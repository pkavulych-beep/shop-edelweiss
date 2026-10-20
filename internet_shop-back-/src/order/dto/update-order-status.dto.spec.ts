import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Status } from '../statusEnum';
import { DeliveryMethod } from '../deliveryEnum';
import { UpdateOrderDto } from './update-order.dto';
import { UpdateOrderStatusDto } from './update-order-status.dto';

describe('order status validation', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const validate = (metatype, body: object) => pipe.transform(body, { type: 'body', metatype });

  it.each(Object.values(Status))('accepts status %s', async status => {
    await expect(validate(UpdateOrderStatusDto, { status })).resolves.toEqual({ status });
  });

  it.each([
    ['without status', {}],
    ['with unknown status', { status: 'banana' }],
  ])('UpdateOrderStatusDto rejects a body %s', async (_name, body) => {
    await expect(validate(UpdateOrderStatusDto, body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('UpdateOrderDto rejects an unknown status', async () => {
    await expect(validate(UpdateOrderDto, { id: 1, status: 'banana' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('UpdateOrderDto accepts a known status', async () => {
    await expect(validate(UpdateOrderDto, { id: 1, status: Status.Sent })).resolves.toEqual({
      id: 1,
      status: Status.Sent,
    });
  });

  it('UpdateOrderDto updates the delivery method and department together', async () => {
    await expect(
      validate(UpdateOrderDto, {
        id: 1,
        deliveryMethod: DeliveryMethod.Ukrposhta,
        department: '79000',
      }),
    ).resolves.toEqual({
      id: 1,
      deliveryMethod: DeliveryMethod.Ukrposhta,
      department: '79000',
    });
  });

  it('UpdateOrderDto accepts a patch without a delivery method', async () => {
    await expect(validate(UpdateOrderDto, { id: 1, department: 'Відділення №1' })).resolves.toEqual(
      { id: 1, department: 'Відділення №1' },
    );
  });

  it('UpdateOrderDto rejects an unknown delivery method', async () => {
    await expect(
      validate(UpdateOrderDto, { id: 1, deliveryMethod: 'DHL' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('UpdateOrderDto rejects a Ukrposhta department without an index', async () => {
    await expect(
      validate(UpdateOrderDto, {
        id: 1,
        deliveryMethod: DeliveryMethod.Ukrposhta,
        department: 'Відділення 1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('UpdateOrderDto rejects an id bigger than PostgreSQL integer', async () => {
    await expect(validate(UpdateOrderDto, { id: 99999999999 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('UpdateOrderDto rejects a negative id bigger than PostgreSQL integer', async () => {
    await expect(validate(UpdateOrderDto, { id: -99999999999 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('UpdateOrderDto rejects a zero id', async () => {
    await expect(validate(UpdateOrderDto, { id: 0 })).rejects.toBeInstanceOf(BadRequestException);
  });
});
