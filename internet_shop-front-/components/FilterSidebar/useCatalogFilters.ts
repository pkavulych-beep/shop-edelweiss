import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

// Ключі запиту, які керуються бічною панеллю фільтрів.
export const FILTER_QUERY_KEYS = [
  'sort',
  'onSale',
  'category',
  'size',
  'color',
  'season',
  'priceMin',
  'priceMax',
] as const;

export type CatalogFilters = Record<string, string>;

const DEBOUNCE_MS = 300;

const pickFilters = (query: Record<string, unknown>): CatalogFilters => {
  const filters: CatalogFilters = {};
  FILTER_QUERY_KEYS.forEach((key) => {
    const value = query[key];
    if (typeof value === 'string' && value !== '') {
      filters[key] = value;
    }
  });
  return filters;
};

const sameFilters = (a: CatalogFilters, b: CatalogFilters) =>
  JSON.stringify(a) === JSON.stringify(b);

// Тримає вибрані фільтри в локальному стані, щоб галочки ставились одразу,
// і застосовує кілька швидких кліків одним переходом. URL лишається джерелом
// істини: коли він змінюється ззовні (Назад/Вперед, «Очистити все», хрестик
// на чіпі), локальний стан підтягується з нього.
export const useCatalogFilters = () => {
  const router = useRouter();

  const [filters, setFiltersState] = useState<CatalogFilters>(() =>
    pickFilters(router.query),
  );
  const filtersRef = useRef(filters);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(filters);
  // JSON фільтрів останнього власного переходу. Поки він не збігся з URL,
  // наш перехід ще в дорозі, і синхронізація з URL не потрібна.
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    const urlFilters = pickFilters(router.query);
    if (pendingRef.current !== null) {
      if (JSON.stringify(urlFilters) === pendingRef.current) {
        pendingRef.current = null;
      }
      return;
    }
    if (!sameFilters(filtersRef.current, urlFilters)) {
      filtersRef.current = urlFilters;
      setFiltersState(urlFilters);
    }
  }, [router.query]);

  const pushNow = useCallback(
    (next: CatalogFilters) => {
      // Нефільтрові параметри (наприклад, gender) беремо з поточного запиту,
      // а всі фільтри — з локального стану, щоб не загубити швидкі кліки.
      const newQuery: Record<string, string> = {};
      Object.entries(router.query).forEach(([key, value]) => {
        if (typeof value === 'string') newQuery[key] = value;
      });
      FILTER_QUERY_KEYS.forEach((key) => {
        if (next[key]) newQuery[key] = next[key];
        else delete newQuery[key];
      });
      delete newQuery.page;

      const nextKey = JSON.stringify(pickFilters(newQuery));
      if (nextKey === pendingRef.current) return;
      pendingRef.current = nextKey;
      router.push({ pathname: router.pathname, query: newQuery }, undefined, {
        shallow: false,
      });
    },
    [router],
  );

  const schedulePush = useCallback(
    (next: CatalogFilters) => {
      latestRef.current = next;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        pushNow(latestRef.current);
      }, DEBOUNCE_MS);
    },
    [pushNow],
  );

  // Шухляда фільтрів на мобільному розмонтовується після закриття, тож
  // невідкладений перехід треба застосувати, а не скасувати.
  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        pushNow(latestRef.current);
      }
    },
    [pushNow],
  );

  const updateFilters = useCallback(
    (updater: (prev: CatalogFilters) => CatalogFilters) => {
      const next = updater(filtersRef.current);
      filtersRef.current = next;
      setFiltersState(next);
      schedulePush(next);
    },
    [schedulePush],
  );

  const setFilter = useCallback(
    (key: string, value: string | undefined) => {
      updateFilters((prev) => {
        const next = { ...prev };
        if (value === undefined || value === '') delete next[key];
        else next[key] = value;
        return next;
      });
    },
    [updateFilters],
  );

  return { filters, setFilter };
};
