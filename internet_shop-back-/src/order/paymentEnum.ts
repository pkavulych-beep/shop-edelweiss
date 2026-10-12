export enum PaymentMethod {
  Cod = 'COD',
  Card = 'CARD',
}

export enum PaymentStatus {
  NotRequired = 'NOT_REQUIRED',
  Pending = 'PENDING',
  Paid = 'PAID',
  Failed = 'FAILED',
  Refunded = 'REFUNDED',
}

export const paymentMethodMessage = `Спосіб оплати має бути одним із: ${Object.values(PaymentMethod).join(', ')}`;
