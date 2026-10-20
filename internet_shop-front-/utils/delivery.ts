import { DeliveryMethod, Order } from '../redux/Types/orderType';

// Варіант міста в пошуку доставки: id — для запиту відділень
// (у Нової пошти це сама назва, у Meest — city_id), label — для показу
export type DeliveryCityOption = {
  id: string;
  label: string;
};

// Пошук міст і відділень перевізника: однакові функції для обох автокомплітів
export type DeliverySearch = {
  getCities: (query: string) => Promise<DeliveryCityOption[]>;
  getDepartments: (city: DeliveryCityOption) => Promise<string[]>;
};

// Назви перевізників: єдине джерело для рядка доставки і для вибору в оформленні
export const deliveryMethodLabels: Record<DeliveryMethod, string> = {
  [DeliveryMethod.NovaPoshta]: 'Нова пошта',
  [DeliveryMethod.Ukrposhta]: 'Укрпошта',
  [DeliveryMethod.Meest]: 'Meest Пошта',
};

// Укрпошта адресує відділення індексом, решта перевізників — назвою відділення
export const formatDelivery = (
  order: Pick<Order, 'cityName' | 'department'> & { deliveryMethod?: DeliveryMethod },
): string => {
  const method = order.deliveryMethod ?? DeliveryMethod.NovaPoshta;
  const carrier = deliveryMethodLabels[method];
  return method === DeliveryMethod.Ukrposhta
    ? `${carrier}, ${order.cityName}, відділення з індексом ${order.department}`
    : `${carrier}, ${order.cityName}, ${order.department}`;
};
