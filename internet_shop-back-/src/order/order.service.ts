import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderItemDto } from './dto/order-item.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { FindOrdersDto } from './dto/find-orders.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { OrderEntity } from './entities/order.entity';
import { ProductService } from '../product/product.service';
import { UsersService } from 'src/user/user.service';
import { Status } from './statusEnum';
import { ProductEntity, ProductStatus } from '../product/entities/product.entity';

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
      const key = `${item.productId}:${item.size ?? ''}`;
      const quantity = (merged.get(key)?.quantity ?? 0) + item.quantity;
      merged.set(key, { ...item, quantity });
    }

    const ids = [...new Set(items.map(item => item.productId))];
    const products = new Map(
      (await this.productService.findPurchasable(ids)).map(product => [product.id, product]),
    );

    return [...merged.values()].map(({ productId, size, quantity }) => {
      const product = products.get(productId);
      if (!product) {
        throw new NotFoundException(null, 'Товар не знайдено або недоступний для замовлення');
      }
      const effectiveSize = size ?? '';
      if (product.sizes?.length) {
        if (!effectiveSize || !product.sizes.includes(effectiveSize)) {
          throw new BadRequestException(effectiveSize ? `Розміру ${effectiveSize} немає в наявності` : 'Оберіть розмір товару');
        }
      }
      if (product.count !== null && product.count !== undefined && quantity > product.count) {
        throw new BadRequestException(`Недостатньо товару на складі. Доступно: ${product.count}`);
      }
      const price = product.salePrice > 0 ? product.salePrice : product.price;
      return { productId, size: effectiveSize, quantity, price };
    });
  }

  findOneWithItems(idOrder: number, withUser = false) {
    return this.repository.findOne({
      where: { id: idOrder },
      relations: { items: { product: true }, user: withUser },
      order: { items: { id: 'ASC' } },
    });
  }

  // Власник бачить лише свої замовлення, ADMIN — будь-які разом із покупцем
  async findOneForUser(idOrder: number, user: { id: number; roles?: { value: string }[] }) {
    const order = await this.findOneWithItems(idOrder, true);
    if (!order) {
      throw new NotFoundException(null, 'Не знайдено такого замовлення');
    }
    const isAdmin = user.roles?.some(role => role.value === 'ADMIN');
    if (order.user?.id !== user.id && !isAdmin) {
      throw new ForbiddenException('Немає доступу до цього замовлення');
    }
    if (isAdmin) {
      return order;
    }
    const { user: _owner, ...result } = order;
    return result;
  }

  async create(userId: number, createOrderDto: CreateOrderDto) {
    const { items, ...restDto } = createOrderDto;
    const orderItems = await this.buildItems(items);
    const user = await this.userService.findOne(userId);

    // Use transaction to ensure order creation and stock decrement are atomic
    return this.repository.manager.transaction(async (manager: EntityManager) => {
      // Save the order
      const order = await manager.save(OrderEntity, {
        user,
        status: Status.Processed,
        ...restDto,
        items: orderItems,
        total: orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
      });

      // Decrement product count for each item
      for (const item of orderItems) {
        const product = await manager.findOne(ProductEntity, { where: { id: item.productId } });
        if (product && product.count !== null && product.count !== undefined) {
          product.count -= item.quantity;
          // Update status to out-of-stock if count reaches 0
          if (product.count <= 0) {
            product.count = 0;
            product.status = ProductStatus.OutOfStock;
          }
          await manager.save(ProductEntity, product);
        }
      }

      // Return the order with items
      return this.findOneWithItems(order.id);
    });
  }

  async findOneById(id: number) {
    const order = await this.repository.findOne({ where: { id } });
    if (order) {
      return order;
    } else {
      throw new NotFoundException(null, 'Не знайдено такого замовлення');
    }
  }

  // Список для адмінки: покупець (ім'я, телефон) і кількість позицій без
  // самих позицій, нові першими. Аліас не «order»: це ключове слово SQL
  async findAll({ page = 1, limit = 20, status }: FindOrdersDto) {
    const query = this.repository
      .createQueryBuilder('o')
      .leftJoin('o.user', 'user')
      .addSelect(['user.id', 'user.fullName', 'user.phoneNumber'])
      .loadRelationCountAndMap('o.itemsCount', 'o.items')
      .orderBy('o.createdAt', 'DESC')
      .addOrderBy('o.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (status) {
      query.where('o.status = :status', { status });
    }

    const [data, total] = await query.getManyAndCount();
    return { data, total, page, limit };
  }

  // Замовлення користувача разом із позиціями одним запитом, нові першими
  findUserOrders(userId: number) {
    return this.repository.find({
      relations: { items: { product: true } },
      where: { user: { id: userId } },
      order: { createdAt: 'DESC', id: 'DESC', items: { id: 'ASC' } },
    });
  }

  async update(updateOrderDto: UpdateOrderDto) {
    const { id, ...changes } = updateOrderDto;
    const order = await this.findOneById(id);
    // Поля, яких немає в запиті, не чіпаємо
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) order[key] = value;
    }

    return this.repository.save(order);
  }

  async updateStatus(id: number, status: Status) {
    const order = await this.findOneById(id);
    order.status = status;
    return this.repository.save(order);
  }

  async remove(id: number) {
    const { affected } = await this.repository.delete(id);
    if (!affected) {
      throw new NotFoundException(null, 'Не знайдено такого замовлення');
    }
    return 'Замовлення було успішно видалено';
  }
}
