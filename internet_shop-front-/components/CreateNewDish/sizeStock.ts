// У формі залишок по розмірах — рядки «розмір + кількість», а бек чекає об'єкт { S: 3, M: 0 }
export interface ISizeStockRow {
  size: string;
  count: number | string;
}

export const rowsToSizeStock = (rows: ISizeStockRow[] | undefined): Record<string, number> | null =>
  rows?.length ? Object.fromEntries(rows.map((row) => [row.size.trim(), Number(row.count)])) : null;

// Для старих товарів без sizeStock кількість лишаємо порожньою, щоб адмін її вказав
export const productToRows = (product: {
  sizes?: string[] | null;
  sizeStock?: Record<string, number> | null;
}): ISizeStockRow[] =>
  product.sizeStock
    ? Object.entries(product.sizeStock).map(([size, count]) => ({ size, count }))
    : (product.sizes ?? []).map((size) => ({ size, count: '' }));
