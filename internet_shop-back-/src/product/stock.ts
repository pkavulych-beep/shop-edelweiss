import { ProductEntity } from './entities/product.entity';

export type SizeStock = Record<string, number>;

type Stocked = Pick<ProductEntity, 'count' | 'sizeStock'>;

// Залишок по розмірах приходить з FormData JSON-рядком ('{"S":3}') або
// об'єктом із JSON-запиту. Порожнє значення чи {} означає «без розмірів» (null).
// Що не вдалося розібрати, повертаємо як є: його відкине валідація.
export const parseSizeStock = (value: unknown): unknown => {
  if (value === undefined || value === null) return value;
  let parsed = value;
  if (typeof value === 'string') {
    if (value.trim() === '') return null;
    try {
      parsed = JSON.parse(value);
    } catch {
      return value;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return parsed;
  }
  const entries = Object.entries(parsed).map(([size, count]) => [size.trim(), count] as const);
  if (entries.length === 0) return null;
  const trimmed = Object.fromEntries(entries);
  // Розміри, що збігаються після trim (" S" і "S"), лишаємо як були: валідація
  // відкине пробіли, а не мовчки зведе їх в один
  return Object.keys(trimmed).length === entries.length ? trimmed : parsed;
};

// Ключі — непорожні розміри без пробілів по краях, значення — цілі числа ≥ 0
export const isValidSizeStock = (value: unknown): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return (
    Object.keys(value).every(size => size !== '' && size === size.trim()) &&
    Object.values(value).every(count => Number.isInteger(count) && count >= 0)
  );
};

// Розміри й загальна кількість товару, виведені із залишку по розмірах
export const fromSizeStock = (sizeStock: SizeStock) => ({
  sizes: Object.keys(sizeStock),
  count: Object.values(sizeStock).reduce((sum, count) => sum + count, 0),
});

// Скільки одиниць товару в цьому розмірі можна купити.
// null — залишок не ведеться (count = NULL і розмірів без залишку)
export const availableFor = (product: Stocked, size: string | null | undefined): number | null => {
  if (product.sizeStock) return product.sizeStock[size ?? ''] ?? 0;
  return product.count ?? null;
};

// Змінює залишок розміру (і загальний count) на delta. Повертає false, якщо
// змінювати нічого: залишок не ведеться або розміру вже немає в товарі
export const applyStockDelta = (
  product: Stocked,
  size: string | null | undefined,
  delta: number,
): boolean => {
  if (product.sizeStock) {
    const key = size ?? '';
    if (!(key in product.sizeStock)) return false;
    product.sizeStock = {
      ...product.sizeStock,
      [key]: product.sizeStock[key] + delta,
    };
    product.count = fromSizeStock(product.sizeStock).count;
    return true;
  }
  if (product.count === null || product.count === undefined) return false;
  product.count += delta;
  return true;
};
