import {
  ArgumentMetadata,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { MAX_INT } from './constants';
import { ParseIdPipe } from './parse-id.pipe';

const param: ArgumentMetadata = { type: 'param', data: 'id', metatype: Number };

describe('ParseIdPipe', () => {
  const pipe = new ParseIdPipe('Товар не знайдено');
  const defaultPipe = new ParseIdPipe();

  it.each(['1', '42', String(MAX_INT)])('keeps the existing id %s', async value => {
    await expect(pipe.transform(value, param)).resolves.toBe(Number(value));
  });

  it.each(['0', '-1', String(MAX_INT + 1), '99999999999', String(MAX_INT * 10)])(
    'answers 404 for %s instead of 500 from the database',
    async value => {
      const error = await pipe.transform(value, param).catch(e => e);
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getStatus()).toBe(404);
      expect(error.message).toBe('Товар не знайдено');
    },
  );

  it('uses a generic message when no resource name is given', async () => {
    const error = await defaultPipe.transform('99999999999', param).catch(e => e);
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.message).toBe('Не знайдено');
  });

  it.each(['', 'abc', '1.5'])('still answers 400 for %s', async value => {
    const error = await pipe.transform(value, param).catch(e => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getStatus()).toBe(400);
  });
});
