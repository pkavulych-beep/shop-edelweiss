interface IStockSource {
  sizeStock?: Record<string, number> | null;
  count?: number | null;
}

export const outOfStockMessage = (available: number) =>
  `Недостатньо товару на складі. Доступно: ${available}`;

// Скільки одиниць можна купити: залишок розміру, якщо товар має sizeStock,
// інакше загальний count. null — залишок не ведеться (без обмеження).
export const availableStock = (product: IStockSource, size?: string | null): number | null => {
  if (product.sizeStock) {
    return size ? product.sizeStock[size] ?? 0 : null;
  }
  return product.count ?? null;
};
