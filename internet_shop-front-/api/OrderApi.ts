import { AxiosInstance } from "axios";
import { Order } from "../redux/Types/orderType";

export interface CreateOrderItemDto {
  productId: number;
  size: string;
  quantity: number;
}

// Користувача бекенд бере з JWT-токена, ціни й суму рахує сам
export interface CreateOrderDto {
  items: CreateOrderItemDto[];
  cityName: string;
  department: string;
  comment: string;
}

export const ordersApi = (instance: AxiosInstance) => ({
  async create(dto: CreateOrderDto) {
    const { data } = await instance.post<Order>("order", dto);
    return data;
  },

  async findMy() {
    const { data } = await instance.get<Order[]>("order/my");
    return data;
  },

  //for Admin
  async findAll() {
    const { data } = await instance.get<Order[]>("order");
    return data;
  },

  async findIncomplete() {
    const { data } = await instance.get<Order[]>("order/Incomplete");
    return data;
  },
});
