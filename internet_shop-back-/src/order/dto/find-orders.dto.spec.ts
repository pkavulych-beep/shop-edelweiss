import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Status } from '../statusEnum';
import { FindOrdersDto } from './find-orders.dto';

describe('FindOrdersDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const validate = (query: object) =>
    pipe.transform(query, { type: 'query', metatype: FindOrdersDto });

  it('uses the first page of 20 orders by default', async () => {
    await expect(validate({})).resolves.toEqual({ page: 1, limit: 20 });
  });

  it('parses query strings and keeps a known status', async () => {
    await expect(validate({ page: '3', limit: '50', status: Status.Sent })).resolves.toEqual({
      page: 3,
      limit: 50,
      status: Status.Sent,
    });
  });

  it.each([
    ['page is not a number', { page: 'abc' }],
    ['page is zero', { page: '0' }],
    ['page is fractional', { page: '1.5' }],
    ['limit is zero', { limit: '0' }],
    ['limit is too big', { limit: '101' }],
    ['status is unknown', { status: 'banana' }],
  ])('rejects a query where %s', async (_name, query) => {
    await expect(validate(query)).rejects.toBeInstanceOf(BadRequestException);
  });
});
