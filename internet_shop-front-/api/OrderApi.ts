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

  getOrdersUser: async function (userId: number) {
    const { data } = await instance.get(`users/order/${userId}`);

    const dataRequests = data.map((item) => instance.get(`order/${item.id}`));
    const orders = await Promise.all<any>(dataRequests);
    const dataOrders = orders.map((el) => {
      return el.data;
    });
    console.log(dataOrders);
    return dataOrders;
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
