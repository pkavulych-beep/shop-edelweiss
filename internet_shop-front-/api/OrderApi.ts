import { AxiosInstance } from "axios";
import { Order, OrderListItem, Status } from "../redux/Types/orderType";

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

// Список усіх замовлень для адміна (GET /order)
export interface FindOrdersParams {
  page?: number;
  limit?: number;
  status?: Status;
}

export interface OrdersPage {
  data: OrderListItem[];
  total: number;
  page: number;
  limit: number;
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

  async findAll(params: FindOrdersParams = {}) {
    const { data } = await instance.get<OrdersPage>("order", { params });
    return data;
  },

  async findById(id: number) {
    // Деталі одного замовлення: разом із позиціями, товарами і покупцем
    const { data } = await instance.get<Order>(`order/${id}`);
    return data;
  },

  async updateStatus(id: number, status: Status) {
    // Зміна статусу — PATCH /order/:id/status, лише для адміна
    const { data } = await instance.patch<Order>(`order/${id}/status`, { status });
    return data;
  },
});
