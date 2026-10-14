import { IProduct, IUserData } from './ProductType';

export enum Status {
  Processed = 'обробляється',
  Sent = 'відправлено',
  Received = 'отримано',
  Canceled = 'відмінено',
}

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

// price — ціна за одиницю на момент покупки
export type OrderItem = {
  id: number;
  productId: number;
  size: string;
  quantity: number;
  price: number;
  product: IProduct;
};

export type Order = {
  id: number;
  // Є лише у відповідях для адміна
  user?: IUserData;
  items: OrderItem[];
  total: number;
  status: Status;
  comment: string;
  cityName: string;
  department: string;
  createdAt: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
};

// Замовлення в адмінському списку: без позицій, лише їх кількість
export type OrderListItem = Omit<Order, "items" | "user"> & {
  user: Pick<IUserData, "id" | "fullName" | "phoneNumber"> | null;
  itemsCount: number;
};
