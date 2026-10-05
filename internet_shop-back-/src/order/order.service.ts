import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
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

  // Власник бачить лише свої замовлення, ADMIN — будь-які
  async findOneForUser(
    idOrder: number,
    user: { id: number; roles?: { value: string }[] },
  ) {
    const order = await this.repository.findOne({
      where: { id: idOrder },
      relations: ['productsInOrder', 'user'],
    });
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
    const { productId, ...restDto } = createOrderDto;
    await this.productService.assertPurchasable(productId);
    const user = await this.userService.findOne(userId);

    // Товари завантажуємо до збереження, а замовлення зберігаємо разом із ними
    // в одній транзакції, щоб не лишилося замовлення без товарів
    const order = await this.repository.manager.transaction(async (manager) => {
      const productsInOrder = await this.productService.findProductsMain(
        productId,
        manager,
      );
      return manager.save(OrderEntity, {
        user,
        status: Status.Processed,
        ...restDto,
        productsInOrder,
      });
    });

    const { user: _owner, ...result } = order;
    return result;
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
    return this.repository.find({ relations: ['user', 'productsInOrder'] });
  }

  findIncomplete() {
    return this.repository.find({
      relations: ['user', 'productsInOrder'],
      where: [{ status: Status.Processed }, { status: Status.Sent }],
    });
  }

  // findUserOrders(idUser: number) {
  //   return this.repository.find({
  //     relations: ['user', 'productsInOrder'],
  //     where: [{ user.id: idUser }],
  //   });
  // }

  async update(updateOrderDto: UpdateOrderDto) {
    const order = await this.findOneById(updateOrderDto.id);
    order.status = updateOrderDto.status;
    order.comment = updateOrderDto.comment;

    return this.repository.manager.transaction(async (manager) => {
      // Без productId товари замовлення лишаються як були
      if (updateOrderDto.productId !== undefined) {
        order.productsInOrder = await this.productService.findProductsMain(
          updateOrderDto.productId,
          manager,
        );
      }
      return manager.save(order);
    });
  }

  async remove(id: number) {
    await this.repository.delete(id);
    return 'Замовлення було успішно видалено';
  }
}
