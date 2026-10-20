import { DeliveryMethod, Order } from '../redux/Types/orderType';

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
