import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { FilterProductDto } from './filter-product.dto';

describe('FilterProductDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const validate = (query: object) =>
    pipe.transform(query, { type: 'query', metatype: FilterProductDto });

  it('keeps the known filters', async () => {
    await expect(
      validate({
        gender: 'woman',
        category: 'dresses',
        priceMin: '100',
        priceMax: '500',
        search: 'літня',
        sort: 'price_asc',
        page: '3',
        limit: '40',
      }),
    ).resolves.toEqual({
      gender: 'woman',
      category: 'dresses',
      priceMin: 100,
      priceMax: 500,
      search: 'літня',
      sort: 'price_asc',
      page: 3,
      limit: 40,
    });
  });

  it('drops an unknown filter', async () => {
    await expect(validate({ hacker: 'true' })).resolves.toEqual({});
  });

  describe('category', () => {
    it.each([['dresses'], ['hoodies'], ['dresses,hoodies']])(
      'accepts %s',
      async value => {
        await expect(validate({ category: value })).resolves.toEqual({
          category: value,
        });
      },
    );

    it('accepts an empty category', async () => {
      await expect(validate({ category: '' })).resolves.toEqual({
        category: '',
      });
    });

    it.each([['bogus'], ['dress,bogus']])(
      'rejects %s',
      async value => {
        await expect(validate({ category: value })).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );
  });

  describe('season', () => {
    it.each([['all-season'], ['autumn-winter'], ['spring-summer,autumn-winter']])(
      'accepts %s',
      async value => {
        await expect(validate({ season: value })).resolves.toEqual({
          season: value,
        });
      },
    );

    it('accepts an empty season', async () => {
      await expect(validate({ season: '' })).resolves.toEqual({
        season: '',
      });
    });

    it.each([['zzz'], ['spring-summer,zzz']])('rejects %s', async value => {
      await expect(validate({ season: value })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('onSale', () => {
    it.each([
      ['true', true],
      ['false', false],
      [true, true],
      [false, false],
    ])('reads %s as %s', async (value, expected) => {
      await expect(validate({ onSale: value })).resolves.toEqual({
        onSale: expected,
      });
    });

    it('ignores an empty onSale', async () => {
      await expect(validate({ onSale: '' })).resolves.toEqual({});
    });

    it('rejects anything else', async () => {
      await expect(validate({ onSale: 'yes' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('page', () => {
    it.each([['1'], ['20'], [1]])('accepts %s', async value => {
      await expect(validate({ page: value })).resolves.toEqual({
        page: Number(value),
      });
    });

    it('ignores an empty page', async () => {
      await expect(validate({ page: '' })).resolves.toEqual({});
    });

    it.each([
      ['zero', '0'],
      ['negative', '-1'],
      ['fractional', '1.5'],
      ['not a number', 'abc'],
    ])('rejects a %s page', async (_name, value) => {
      await expect(validate({ page: value })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('limit', () => {
    it.each([['1'], ['20'], ['100']])('accepts %s', async value => {
      await expect(validate({ limit: value })).resolves.toEqual({
        limit: Number(value),
      });
    });

    it('ignores an empty limit', async () => {
      await expect(validate({ limit: '' })).resolves.toEqual({});
    });

    it.each([
      ['zero', '0'],
      ['negative', '-5'],
      ['fractional', '1.5'],
      ['not a number', 'abc'],
      ['above the maximum', '101'],
    ])('rejects a %s limit', async (_name, value) => {
      await expect(validate({ limit: value })).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
