import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserEntity } from './entities/user.entity';
import { BasketItemEntity } from './entities/basket-item.entity';
import { CreateLoginUserDto } from './dto/login-user.dto';
import { RolesService } from '../roles/roles.service';
import { ProductService } from '../product/product.service';
import { productToBasketDto } from './dto/productToBasket.dto';
import { SyncCartItemDto } from './dto/sync-cart.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private repository: Repository<UserEntity>,
    @InjectRepository(BasketItemEntity)
    private basketRepository: Repository<BasketItemEntity>,
    private roleRepository: RolesService,
    private productService: ProductService,
  ) {}

  async create(dto: CreateUserDto) {
    const existing = await this.repository.findOne({
      where: [{ phoneNumber: dto.phoneNumber }, { email: dto.email }],
    });

    if (existing) {
      const message =
        existing.phoneNumber === dto.phoneNumber
          ? 'Користувач з таким номером телефону вже існує'
          : 'Користувач з такою електронною поштою вже існує';
      throw new ConflictException(message);
    }

    const user = this.repository.create(dto);
    const role = await this.roleRepository.getRoleByValue('USER');
    user.roles = [role];
    return await this.repository.save(user);
  }

  findAll() {
    return this.repository.find({ relations: ['cartItems'] });
  }

  findOne(id: number): Promise<UserEntity> {
    return this.repository.findOne({
      where: {
        id: +id,
      },
    });
  }

  async getCartItems(userId: number): Promise<BasketItemEntity[]> {
    return this.basketRepository.find({
      where: { userId },
      relations: ['product'],
    });
  }

  async findById(id: number): Promise<UserEntity> {
    return await this.repository.findOne({
      where: { id: +id },
      relations: ['roles', 'cartItems', 'cartItems.product'],
    });
  }

  async findByCond(cond: CreateLoginUserDto) {
    return await this.repository.findOne({
      where: cond,
      relations: ['roles', 'cartItems', 'cartItems.product'],
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    await this.repository.update(id, updateUserDto);
    return await this.repository.findOne({ where: { id } });
  }

  async addProductToBasket(
    idUser: number,
    { idProduct, size }: productToBasketDto,
  ) {
    await this.productService.assertPurchasable([idProduct]);

    // Перевірити чи вже є такий товар з таким розміром в корзині
    const existing = await this.basketRepository.findOne({
      where: { userId: idUser, productId: idProduct, size },
    });

    if (existing) {
      existing.quantity += 1;
      return await this.basketRepository.save(existing);
    }

    const basketItem = this.basketRepository.create({
      userId: idUser,
      productId: idProduct,
      size,
      quantity: 1,
    });
    return await this.basketRepository.save(basketItem);
  }

  async pickUpFromTheBasket(
    idUser: number,
    { idProduct, size }: productToBasketDto,
  ) {
    await this.basketRepository.delete({ userId: idUser, productId: idProduct, size });
    return await this.getCartItems(idUser);
  }

  async cleanTheBasket(idUser: number) {
    await this.basketRepository.delete({ userId: idUser });
    return { cartItems: [] };
  }

  async syncCart(idUser: number, items: SyncCartItemDto[]) {
    // Приховані («видалені») товари з гостьового кошика пропускаємо
    const purchasable = new Set(
      await this.productService.findPurchasableIds(
        items.map((item) => item.productId),
      ),
    );

    for (const item of items) {
      if (!purchasable.has(item.productId)) continue;

      const existing = await this.basketRepository.findOne({
        where: { userId: idUser, productId: item.productId, size: item.size },
      });

      if (existing) {
        existing.quantity += item.quantity;
        await this.basketRepository.save(existing);
      } else {
        const basketItem = this.basketRepository.create({
          userId: idUser,
          productId: item.productId,
          size: item.size,
          quantity: item.quantity,
        });
        await this.basketRepository.save(basketItem);
      }
    }
    return await this.getCartItems(idUser);
  }

  async findOrders(id: number) {
    const user = await this.repository.findOne({
      where: {
        id,
      },
      relations: ['orders'],
    });
    if (!user) {
      throw new NotFoundException('Користувача не знайдено');
    }
    return user.orders;
  }
}
