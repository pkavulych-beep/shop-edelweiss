import {
  applyStockDelta,
  availableFor,
  fromSizeStock,
  isValidSizeStock,
  parseSizeStock,
} from './stock';

describe('stock', () => {
  describe('parseSizeStock', () => {
    it('reads a JSON string from FormData and trims sizes', () => {
      expect(parseSizeStock('{" S ":3,"M":0}')).toEqual({ S: 3, M: 0 });
    });

    it('treats an empty value as a product without sizes', () => {
      expect(parseSizeStock('')).toBeNull();
      expect(parseSizeStock('{}')).toBeNull();
      expect(parseSizeStock({})).toBeNull();
    });

    it('leaves what it cannot read to the validation', () => {
      expect(parseSizeStock('S:3')).toBe('S:3');
      expect(parseSizeStock('[1]')).toEqual([1]);
      expect(parseSizeStock({ ' S': 1, S: 2 })).toEqual({ ' S': 1, S: 2 });
    });
  });

  describe('isValidSizeStock', () => {
    it.each([
      [{ S: 3, M: 0 }, true],
      [{ S: -1 }, false],
      [{ S: 1.5 }, false],
      [{ S: '3' }, false],
      [{ '': 1 }, false],
      [{ ' S': 1 }, false],
      [[1], false],
      ['S:3', false],
    ])('%j → %s', (value, valid) => {
      expect(isValidSizeStock(value)).toBe(valid);
    });
  });

  it('derives sizes in order and the total count', () => {
    expect(fromSizeStock({ S: 3, M: 0, L: 5 })).toEqual({ sizes: ['S', 'M', 'L'], count: 8 });
  });

  describe('availableFor', () => {
    it('reads the stock of the size', () => {
      const product = { count: 5, sizeStock: { S: 5, M: 0 } };
      expect(availableFor(product, 'S')).toBe(5);
      expect(availableFor(product, 'M')).toBe(0);
      expect(availableFor(product, 'XL')).toBe(0);
    });

    it('falls back to count for a product without stock per size', () => {
      expect(availableFor({ count: 4, sizeStock: null }, 'S')).toBe(4);
      expect(availableFor({ count: null, sizeStock: null }, '')).toBeNull();
    });
  });

  describe('applyStockDelta', () => {
    it('changes the size and keeps count as the sum', () => {
      const product = { count: 5, sizeStock: { S: 2, M: 3 } };
      expect(applyStockDelta(product, 'S', -2)).toBe(true);
      expect(product).toEqual({ count: 3, sizeStock: { S: 0, M: 3 } });
    });

    it('does not bring back a size the product no longer has', () => {
      const product = { count: 3, sizeStock: { M: 3 } };
      expect(applyStockDelta(product, 'S', 1)).toBe(false);
      expect(product).toEqual({ count: 3, sizeStock: { M: 3 } });
    });

    it('changes count of a product without stock per size', () => {
      const product = { count: 3, sizeStock: null };
      expect(applyStockDelta(product, 'S', 2)).toBe(true);
      expect(product.count).toBe(5);
      expect(applyStockDelta({ count: null, sizeStock: null }, '', 1)).toBe(false);
    });
  });
});
