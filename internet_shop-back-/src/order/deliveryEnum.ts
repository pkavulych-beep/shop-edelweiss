export enum DeliveryMethod {
  NovaPoshta = 'NOVA_POSHTA',
  Ukrposhta = 'UKRPOSHTA',
  Meest = 'MEEST',
}

export const deliveryMethodMessage = `Спосіб доставки має бути одним із: ${Object.values(DeliveryMethod).join(', ')}`;

// Укрпошта адресує відділення індексом, а не назвою, як інші перевізники
export const ukrposhtaIndexMessage =
  'Вкажіть індекс відділення Укрпошти: 5 цифр';
