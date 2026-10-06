import { AxiosInstance } from "axios";
import { Order } from "../redux/Types/orderType";

// Користувача бекенд бере з JWT-токена
export interface CreateOrderDto {
  productId: number[];
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
