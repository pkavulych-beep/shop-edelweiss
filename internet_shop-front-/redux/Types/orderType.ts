import { IProduct, IUserData } from './ProductType';

export enum Status {
  Processed = 'обробляється',
  Sent = 'відправлено',
  Received = 'отримано',
  Canceled = 'відмінено',
}

export type Order = {
  id: number;
  user: IUserData;
  productsInOrder: IProduct[];
  status: Status;
  comment: string;
  cityName: string;
};
