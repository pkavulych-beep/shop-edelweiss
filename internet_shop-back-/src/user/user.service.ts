import {
  BadRequestException,
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
import { RolesService } from '../roles/roles.service';
import { ProductService } from '../product/product.service';
import { productToBasketDto } from './dto/productToBasket.dto';
import { SyncCartItemDto } from './dto/sync-cart.dto';
import { hashPassword } from '../auth/password';
import { normalizeEmail } from '../common/email';

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
    const email = normalizeEmail(dto.email) as string | undefined;

    const existing = await this.repository.findOne({
      where: email
        ? [{ phoneNumber: dto.phoneNumber }, { email }]
        : [{ phoneNumber: dto.phoneNumber }],
    });

    if (existing) {
      const message =
        existing.phoneNumber === dto.phoneNumber
          ? 'Користувач з таким номером телефону вже існує'
          : 'Користувач з такою електронною поштою вже існує';
      throw new ConflictException(message);
    }

    const user = this.repository.create({
      ...dto,
      email,
      password: await hashPassword(dto.password),
    });
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

  // Пароль має select: false, тож для входу додаємо його в запит явно
  async findByPhoneWithPassword(phoneNumber: string): Promise<UserEntity> {
    return await this.repository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.roles', 'roles')
      .leftJoinAndSelect('user.cartItems', 'cartItems')
      .leftJoinAndSelect('cartItems.product', 'product')
      .where('user.phoneNumber = :phoneNumber', { phoneNumber })
      .getOne();
  }

  async setPasswordHash(id: number, passwordHash: string) {
    await this.repository.update(id, { password: passwordHash });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const changes = { ...updateUserDto };
    const email = normalizeEmail(changes.email) as string | undefined;
    if (email === undefined) {
      delete changes.email;
    } else {
      changes.email = email;
    }

    const [phoneOwner, emailOwner] = await Promise.all([
      this.repository.findOne({
        where: { phoneNumber: changes.phoneNumber },
      }),
      email
        ? this.repository.findOne({ where: { email } })
        : undefined,
    ]);

    if (phoneOwner && phoneOwner.id !== id) {
      throw new ConflictException(
        'Користувач з таким номером телефону вже існує',
      );
    }

    if (emailOwner && emailOwner.id !== id) {
      throw new ConflictException(
        'Користувач з такою електронною поштою вже існує',
      );
    }

    if (changes.password) {
      changes.password = await hashPassword(changes.password);
    }
    await this.repository.update(id, changes);
    return await this.findById(id);
  }

  async addProductToBasket(
    idUser: number,
    { idProduct, size }: productToBasketDto,
  ) {
    await this.productService.assertPurchasable([idProduct]);
    const [product] = await this.productService.findProductsMain([idProduct]);

    const effectiveSize = size ?? '';
    if (product.sizes?.length) {
      if (!effectiveSize) {
        throw new BadRequestException('Оберіть розмір товару');
      }
      if (!product.sizes.includes(effectiveSize)) {
        throw new BadRequestException('Такого розміру немає в цього товару');
      }
    }

    // Перевірити чи вже є такий товар з таким розміром в корзині
    const existing = await this.basketRepository.findOne({
      where: { userId: idUser, productId: idProduct, size: effectiveSize },
    });

    if (existing) {
      existing.quantity += 1;
      return await this.basketRepository.save(existing);
    }

    const basketItem = this.basketRepository.create({
      userId: idUser,
      productId: idProduct,
      size: effectiveSize,
      quantity: 1,
    });
    return await this.basketRepository.save(basketItem);
  }

  async pickUpFromTheBasket(
    idUser: number,
    { idProduct, size }: productToBasketDto,
  ) {
    await this.basketRepository.delete({ userId: idUser, productId: idProduct, size: size ?? '' });
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
        where: { userId: idUser, productId: item.productId, size: item.size ?? '' },
      });

      if (existing) {
        existing.quantity += item.quantity;
        await this.basketRepository.save(existing);
      } else {
        const basketItem = this.basketRepository.create({
          userId: idUser,
          productId: item.productId,
          size: item.size ?? '',
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
