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

// Фільтри з URL, на який починається перехід (аргумент router.events).
const filtersKeyFromUrl = (url: string): string => {
  const queryStart = url.indexOf('?');
  const search = queryStart >= 0 ? url.slice(queryStart + 1) : '';
  const params = new URLSearchParams(search.split('#')[0]);
  const filters: CatalogFilters = {};
  FILTER_QUERY_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) filters[key] = value;
  });
  return JSON.stringify(filters);
};

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

  // Чужий перехід (не наш push) означає, що наш перехід скасовано: знімаємо
  // невідкладений debounce і чекаємо, доки router.query підтягне новий стан.
  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  const isOwnNavigation = useCallback((url: string) => {
    if (pendingRef.current === null) return false;
    return filtersKeyFromUrl(url) === pendingRef.current;
  }, []);

  useEffect(() => {
    const handleRouteChangeStart = (url: string) => {
      if (!isOwnNavigation(url)) cancelPending();
    };
    // Скасування нашого переходу нашим же наступним push приходить як
    // routeChangeError із err.cancelled: не чіпаємо pendingRef (його вже
    // перезаписав новий push), далі routeChangeStart сам вирішить, чий це
    // перехід. Справжня помилка переходу — скидаємо стан.
    const handleRouteChangeError = (err: { cancelled?: boolean } | null) => {
      if (err?.cancelled) return;
      cancelPending();
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.events.on('routeChangeError', handleRouteChangeError);
    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
      router.events.off('routeChangeError', handleRouteChangeError);
    };
  }, [router.events, isOwnNavigation, cancelPending]);

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
  // невідкладений перехід треба застосувати, а не скасувати. Якщо ж панель
  // зникає через чужий перехід, таймер уже скасовано в cancelPending.
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
