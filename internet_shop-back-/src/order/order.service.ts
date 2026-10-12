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
import { PaymentMethod, PaymentStatus } from './paymentEnum';
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

    // Sum quantities by productId (across all sizes) for stock validation
    const quantitiesByProduct = new Map<number, number>();
    for (const item of merged.values()) {
      const total = (quantitiesByProduct.get(item.productId) ?? 0) + item.quantity;
      quantitiesByProduct.set(item.productId, total);
    }

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
      const totalQuantity = quantitiesByProduct.get(productId) ?? quantity;
      if (product.count !== null && product.count !== undefined && totalQuantity > product.count) {
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

    // Sum quantities by productId for stock decrement
    const quantitiesByProduct = new Map<number, number>();
    for (const item of orderItems) {
      const total = (quantitiesByProduct.get(item.productId) ?? 0) + item.quantity;
      quantitiesByProduct.set(item.productId, total);
    }

    // Use transaction to ensure order creation and stock decrement are atomic
    return this.repository.manager.transaction(async (manager: EntityManager) => {
      // Save the order
      const order = await manager.save(OrderEntity, {
        user,
        status: Status.Processed,
        ...restDto,
        // Оплата: спосіб беремо з запиту (за замовчуванням — при отриманні), а
        // стан оплати нове замовлення завжди має NOT_REQUIRED
        paymentMethod: restDto.paymentMethod ?? PaymentMethod.Cod,
        paymentStatus: PaymentStatus.NotRequired,
        items: orderItems,
        total: orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
      });

      // Decrement product count atomically with pessimistic locking
      for (const [productId, quantity] of quantitiesByProduct.entries()) {
        // Lock the product row and check stock
        const product = await manager.findOne(ProductEntity, {
          where: { id: productId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!product) {
          throw new NotFoundException(null, 'Товар не знайдено');
        }

        // Only decrement if count is tracked (not null)
        if (product.count !== null && product.count !== undefined) {
          if (product.count < quantity) {
            throw new BadRequestException(`Недостатньо товару на складі. Доступно: ${product.count}`);
          }
          product.count -= quantity;
          await manager.save(ProductEntity, product);
        }
      }

      // Return the order with items using the transaction manager
      return manager.findOne(OrderEntity, {
        where: { id: order.id },
        relations: { items: { product: true }, user: true },
        order: { items: { id: 'ASC' } },
      });
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
    const { id, status, ...changes } = updateOrderDto;
    // If status is being changed, delegate to updateStatus for proper stock handling
    if (status !== undefined) {
      return this.updateStatus(id, status, changes);
    }
    // No status change - just update other fields
    const order = await this.findOneById(id);
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) order[key] = value;
    }
    return this.repository.save(order);
  }

  async updateStatus(id: number, status: Status, changes: Record<string, unknown> = {}) {
    // Use transaction with pessimistic locking on order row to prevent race conditions
    return this.repository.manager.transaction(async (manager: EntityManager) => {
      // First, lock the order row
      const order = await manager.findOne(OrderEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException(null, 'Не знайдено такого замовлення');
      }

      // Now load the order with items (no lock needed since order is locked)
      const orderWithItems = await manager.findOne(OrderEntity, {
        where: { id },
        relations: { items: { product: true } },
        order: { items: { id: 'ASC' } },
      });

      // Apply non-status changes from the request
      for (const [key, value] of Object.entries(changes)) {
        if (value !== undefined) {
          orderWithItems[key] = value;
        }
      }

      // If trying to cancel an already cancelled order, just update status (no stock change)
      if (status === Status.Canceled && orderWithItems.status === Status.Canceled) {
        orderWithItems.status = status;
        return manager.save(OrderEntity, orderWithItems);
      }

      // If transitioning FROM Canceled to another status, decrement stock
      if (orderWithItems.status === Status.Canceled && status !== Status.Canceled) {
        await this.decrementProductCounts(manager, orderWithItems.items);
        orderWithItems.status = status;
        return manager.save(OrderEntity, orderWithItems);
      }

      // If cancelling an order that wasn't already cancelled, restore stock
      if (status === Status.Canceled && orderWithItems.status !== Status.Canceled) {
        await this.restoreProductCounts(manager, orderWithItems.items);
        orderWithItems.status = status;
        return manager.save(OrderEntity, orderWithItems);
      }

      // Any other status change - no stock modification
      orderWithItems.status = status;
      return manager.save(OrderEntity, orderWithItems);
    });
  }

  private async restoreProductCounts(manager: EntityManager, items: OrderEntity['items']) {
    // Sum quantities by productId for stock increment
    const quantitiesByProduct = new Map<number, number>();
    for (const item of items) {
      const total = (quantitiesByProduct.get(item.productId) ?? 0) + item.quantity;
      quantitiesByProduct.set(item.productId, total);
    }

    // Increment product count atomically with pessimistic locking
    for (const [productId, quantity] of quantitiesByProduct.entries()) {
      const product = await manager.findOne(ProductEntity, {
        where: { id: productId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!product) {
        continue; // Product might have been deleted, skip
      }

      // Only increment if count is tracked (not null)
      if (product.count !== null && product.count !== undefined) {
        product.count += quantity;
        await manager.save(ProductEntity, product);
      }
    }
  }

  private async decrementProductCounts(manager: EntityManager, items: OrderEntity['items']) {
    // Sum quantities by productId for stock decrement
    const quantitiesByProduct = new Map<number, number>();
    for (const item of items) {
      const total = (quantitiesByProduct.get(item.productId) ?? 0) + item.quantity;
      quantitiesByProduct.set(item.productId, total);
    }

    // Decrement product count atomically with pessimistic locking
    for (const [productId, quantity] of quantitiesByProduct.entries()) {
      const product = await manager.findOne(ProductEntity, {
        where: { id: productId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!product) {
        throw new NotFoundException(null, 'Товар не знайдено');
      }

      // Only decrement if count is tracked (not null)
      if (product.count !== null && product.count !== undefined) {
        if (product.count < quantity) {
          throw new BadRequestException(`Недостатньо товару на складі. Доступно: ${product.count}`);
        }
        product.count -= quantity;
        await manager.save(ProductEntity, product);
      }
    }
  }

  async remove(id: number) {
    // Use transaction with pessimistic locking on order row to prevent race conditions
    return this.repository.manager.transaction(async (manager: EntityManager) => {
      // First, lock the order row
      const order = await manager.findOne(OrderEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException(null, 'Не знайдено такого замовлення');
      }

      // Now load the order with items (no lock needed since order is locked)
      const orderWithItems = await manager.findOne(OrderEntity, {
        where: { id },
        relations: { items: { product: true } },
        order: { items: { id: 'ASC' } },
      });

      // Only restore stock if order was not already cancelled
      if (orderWithItems.status !== Status.Canceled) {
        await this.restoreProductCounts(manager, orderWithItems.items);
      }

      const { affected } = await manager.delete(OrderEntity, id);
      if (!affected) {
        throw new NotFoundException(null, 'Не знайдено такого замовлення');
      }
      return 'Замовлення було успішно видалено';
    });
  }
}
