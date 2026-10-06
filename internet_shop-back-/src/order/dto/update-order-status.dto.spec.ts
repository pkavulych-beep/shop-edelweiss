import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Status } from '../statusEnum';
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
});
