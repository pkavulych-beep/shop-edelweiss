import { useEffect, useState } from 'react';
import { Api } from '../api/Api';

// Онлайн-оплата доступна, лише коли на бекенді налаштований еквайринг mono.
// Поки відповідь не прийшла (або запит не вдався), картки не пропонуємо.
export const useCardPaymentAvailable = (): boolean => {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Api()
      .payment.getMethods()
      .then(({ card }) => {
        if (!cancelled) setAvailable(card);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return available;
};
