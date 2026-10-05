import { IProduct, IUserData } from './ProductType';

export enum Status {
  Processed = 'обробляється',
  Sent = 'відправлено',
  Received = 'отримано',
  Canceled = 'відмінено',
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
  user?: IUserData;
  items: OrderItem[];
  total: number;
  status: Status;
  comment: string;
  cityName: string;
  department: string;
};
