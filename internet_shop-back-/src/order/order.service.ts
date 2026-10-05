import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderItemDto } from './dto/order-item.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from './entities/order.entity';
import { ProductService } from '../product/product.service';
import { UsersService } from 'src/user/user.service';
import { Status } from './statusEnum';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(OrderEntity)
    private repository: Repository<OrderEntity>,
    private productService: ProductService,
    private userService: UsersService,
  ) {}

  // Однаковий товар у тому ж розмірі зводимо в одну позицію. Ціну беремо
  // з бази (зі знижкою, якщо вона є), а не довіряємо клієнту
  async buildItems(items: OrderItemDto[]) {
    const merged = new Map<string, OrderItemDto>();
    for (const item of items) {
      const key = `${item.productId}:${item.size}`;
      const quantity = (merged.get(key)?.quantity ?? 0) + item.quantity;
      merged.set(key, { ...item, quantity });
    }

    const ids = [...new Set(items.map((item) => item.productId))];
    const products = new Map(
      (await this.productService.findPurchasable(ids)).map((product) => [
        product.id,
        product,
      ]),
    );

    return [...merged.values()].map(({ productId, size, quantity }) => {
      const product = products.get(productId);
      if (!product) {
        throw new NotFoundException(null, 'Товар не знайдено');
      }
      if (product.sizes?.length && !product.sizes.includes(size)) {
        throw new BadRequestException(`Розміру ${size} немає в наявності`);
      }
      const price = product.salePrice > 0 ? product.salePrice : product.price;
      return { productId, size, quantity, price };
    });
  }

  findOneWithItems(idOrder: number, withUser = false) {
    return this.repository.findOne({
      where: { id: idOrder },
      relations: { items: { product: true }, user: withUser },
      order: { items: { id: 'ASC' } },
    });
  }

  // Власник бачить лише свої замовлення, ADMIN — будь-які
  async findOneForUser(
    idOrder: number,
    user: { id: number; roles?: { value: string }[] },
  ) {
    const order = await this.findOneWithItems(idOrder, true);
    if (!order) {
      throw new NotFoundException(null, 'Не знайдено такого замовлення');
    }
    const isAdmin = user.roles?.some((role) => role.value === 'ADMIN');
    if (order.user?.id !== user.id && !isAdmin) {
      throw new ForbiddenException('Немає доступу до цього замовлення');
    }
    const { user: _owner, ...result } = order;
    return result;
  }

  async create(userId: number, createOrderDto: CreateOrderDto) {
    const { items, ...restDto } = createOrderDto;
    const orderItems = await this.buildItems(items);
    const user = await this.userService.findOne(userId);

    const order = await this.repository.save({
      user,
      status: Status.Processed,
      ...restDto,
      items: orderItems,
      total: orderItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      ),
    });

    return this.findOneWithItems(order.id);
  }

  async findOneById(id: number) {
    const order = await this.repository.findOne({ where: { id } });
    if (order) {
      return order;
    } else {
      throw new NotFoundException(null, 'Не знайдено такого замовлення');
    }
  }

  findAll() {
    return this.repository.find({
      relations: { user: true, items: { product: true } },
    });
  }

  findIncomplete() {
    return this.repository.find({
      relations: { user: true, items: { product: true } },
      where: [{ status: Status.Processed }, { status: Status.Sent }],
    });
  }

  // findUserOrders(idUser: number) {
  //   return this.repository.find({
  //     relations: ['user', 'items'],
  //     where: [{ user.id: idUser }],
  //   });
  // }

  async update(updateOrderDto: UpdateOrderDto) {
    const { id, ...changes } = updateOrderDto;
    const order = await this.findOneById(id);
    // Поля, яких немає в запиті, не чіпаємо
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) order[key] = value;
    }

    return this.repository.save(order);
  }

  async remove(id: number) {
    await this.repository.delete(id);
    return 'Замовлення було успішно видалено';
  }
}
