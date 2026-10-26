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
import { DeliveryMethod, ukrposhtaIndexMessage } from './deliveryEnum';
import { ProductEntity } from '../product/entities/product.entity';
import { BasketItemEntity } from '../user/entities/basket-item.entity';
import {
  CARD_PAYMENT_UNAVAILABLE,
  isCardPaymentAvailable,
} from '../payment/card-payment';
import { applyStockDelta, availableFor } from '../product/stock';

type OrderChanges = Omit<UpdateOrderDto, 'id' | 'status'>;
type StockItem = { productId: number; size?: string | null; quantity: number };

// Скільки одиниць просять з кожного залишку товару: з розміру, якщо залишок
// ведеться по розмірах, інакше з загального count (ключ '')
const demandOf = (product: ProductEntity, items: StockItem[]) => {
  const demand = new Map<string, number>();
  for (const { size, quantity } of items) {
    const key = product.sizeStock ? (size ?? '') : '';
    demand.set(key, (demand.get(key) ?? 0) + quantity);
  }
  return demand;
};

const assertInStock = (product: ProductEntity, demand: Map<string, number>) => {
  for (const [size, quantity] of demand) {
    const available = availableFor(product, size);
    if (available === null || quantity <= available) continue;
    if (available === 0 && size) {
      throw new BadRequestException(`Розміру ${size} немає в наявності`);
    }
    throw new BadRequestException(`Недостатньо товару на складі. Доступно: ${available}`);
  }
};

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

    for (const product of products.values()) {
      const productItems = [...merged.values()].filter(item => item.productId === product.id);
      assertInStock(product, demandOf(product, productItems));
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
    // Без налаштованого еквайрингу карткове замовлення неможливо оплатити,
    // тож не створюємо його: інакше покупець застрягне на сторінці помилки.
    if (createOrderDto.paymentMethod === PaymentMethod.Card && !isCardPaymentAvailable()) {
      throw new BadRequestException(CARD_PAYMENT_UNAVAILABLE);
    }

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
        // Оплата: спосіб беремо з запиту (за замовчуванням — при отриманні), а
        // стан оплати нове замовлення завжди має NOT_REQUIRED
        paymentMethod: restDto.paymentMethod ?? PaymentMethod.Cod,
        paymentStatus: PaymentStatus.NotRequired,
        // Перевізник: за замовчуванням Нова пошта, як і спосіб оплати
        deliveryMethod: restDto.deliveryMethod ?? DeliveryMethod.NovaPoshta,
        items: orderItems,
        total: orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
      });

      await this.decrementProductCounts(manager, orderItems);

      // Кошик чистимо в межах тієї ж транзакції: товари вже належать
      // створеному замовленню, тож повторне оформлення не дублює їх
      // (інакше після невдалого інвойсу вони лишалися в кошику, #226)
      await manager.delete(BasketItemEntity, { userId });

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
    this.assertUkrposhtaIndex(order, changes);
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) order[key] = value;
    }
    return this.repository.save(order);
  }

  async updateStatus(id: number, status: Status, changes: OrderChanges = {}) {
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

      this.assertUkrposhtaIndex(orderWithItems, changes);

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

  // Скасовує замовлення, яке досі чекає на оплату, у транзакції виклику:
  // повертає товар на склад і ставить paymentStatus FAILED. Якщо замовлення
  // вже оплачене (вебхук прийшов раніше) або перейшло на інший інвойс,
  // нічого не змінює. Використовується плановою звіркою неоплачених
  // CARD-замовлень.
  async cancelUnpaidOrder(
    manager: EntityManager,
    id: number,
    invoiceId: string,
  ): Promise<OrderEntity | null> {
    const order = await manager.findOne(OrderEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });

    if (
      !order ||
      order.paymentStatus !== PaymentStatus.Pending ||
      order.paymentInvoiceId !== invoiceId ||
      order.status === Status.Canceled
    ) {
      return null;
    }

    const orderWithItems = await manager.findOne(OrderEntity, {
      where: { id },
      relations: { items: { product: true } },
      order: { items: { id: 'ASC' } },
    });

    await this.restoreProductCounts(manager, orderWithItems.items ?? []);
    orderWithItems.status = Status.Canceled;
    orderWithItems.paymentStatus = PaymentStatus.Failed;
    return manager.save(OrderEntity, orderWithItems);
  }

  // Скасовує CARD-замовлення, для якого не вдалося створити інвойс
  // (paymentInvoiceId порожній, paymentStatus = NOT_REQUIRED).
  // Повертає товар на склад, ставить status = Canceled, paymentStatus = FAILED.
  async cancelOrderWithoutInvoice(
    manager: EntityManager,
    id: number,
  ): Promise<OrderEntity | null> {
    const order = await manager.findOne(OrderEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });

    if (
      !order ||
      order.paymentMethod !== PaymentMethod.Card ||
      order.paymentInvoiceId ||
      order.paymentStatus !== PaymentStatus.NotRequired ||
      order.status === Status.Canceled
    ) {
      return null;
    }

    const orderWithItems = await manager.findOne(OrderEntity, {
      where: { id },
      relations: { items: { product: true } },
      order: { items: { id: 'ASC' } },
    });

    await this.restoreProductCounts(manager, orderWithItems.items ?? []);
    orderWithItems.status = Status.Canceled;
    orderWithItems.paymentStatus = PaymentStatus.Failed;
    return manager.save(OrderEntity, orderWithItems);
  }

  // Скасовує CARD-замовлення, оплата якого не пройшла (paymentStatus = FAILED),
  // а рахунок invoiceId уже прострочений. Повертає товар на склад, paymentStatus
  // лишається FAILED. Якщо покупець тим часом створив новий інвойс чи
  // замовлення вже не «обробляється», нічого не змінює.
  async cancelFailedOrder(
    manager: EntityManager,
    id: number,
    invoiceId: string,
  ): Promise<OrderEntity | null> {
    const order = await manager.findOne(OrderEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });

    if (
      !order ||
      order.paymentMethod !== PaymentMethod.Card ||
      order.paymentStatus !== PaymentStatus.Failed ||
      order.paymentInvoiceId !== invoiceId ||
      order.status !== Status.Processed
    ) {
      return null;
    }

    const orderWithItems = await manager.findOne(OrderEntity, {
      where: { id },
      relations: { items: { product: true } },
      order: { items: { id: 'ASC' } },
    });

    await this.restoreProductCounts(manager, orderWithItems.items ?? []);
    orderWithItems.status = Status.Canceled;
    return manager.save(OrderEntity, orderWithItems);
  }

  // Для Укрпошти department — індекс відділення (5 цифр). Перевіряємо підсумковий стан замовлення,
  // але лише коли запит змінює спосіб доставки чи відділення: старі замовлення з довільним
  // department мають і далі змінювати статус чи коментар.
  private assertUkrposhtaIndex(order: OrderEntity, changes: OrderChanges) {
    if (changes.deliveryMethod === undefined && changes.department === undefined) return;
    const deliveryMethod = changes.deliveryMethod ?? order.deliveryMethod;
    const department = changes.department ?? order.department;
    if (deliveryMethod === DeliveryMethod.Ukrposhta && !/^\d{5}$/.test(department ?? '')) {
      throw new BadRequestException(ukrposhtaIndexMessage);
    }
  }

  private restoreProductCounts(manager: EntityManager, items: StockItem[]) {
    return this.changeStock(manager, items, 1);
  }

  private decrementProductCounts(manager: EntityManager, items: StockItem[]) {
    return this.changeStock(manager, items, -1);
  }

  // Змінює залишки товарів позицій (direction 1 — повернути, -1 — списати).
  // Рядок товару блокуємо, щоб паралельні замовлення не списали той самий залишок
  private async changeStock(manager: EntityManager, items: StockItem[], direction: 1 | -1) {
    const itemsByProduct = new Map<number, StockItem[]>();
    for (const item of items) {
      itemsByProduct.set(item.productId, [...(itemsByProduct.get(item.productId) ?? []), item]);
    }

    for (const [productId, productItems] of itemsByProduct) {
      const product = await manager.findOne(ProductEntity, {
        where: { id: productId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!product) {
        if (direction > 0) continue; // Товар могли видалити — повертати нікуди
        throw new NotFoundException(null, 'Товар не знайдено');
      }

      const demand = demandOf(product, productItems);
      if (direction < 0) assertInStock(product, demand);

      let changed = false;
      for (const [size, quantity] of demand) {
        changed = applyStockDelta(product, size, direction * quantity) || changed;
      }
      if (changed) {
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
