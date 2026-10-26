import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ProductService } from '../product/product.service';
import { ProductStatus } from '../product/entities/product.entity';
import { CreateQuickOrderDto } from './dto/create-quick-order.dto';
import { QuickOrderEntity } from './entities/quick-order.entity';
import { normalizePhone } from '../common/phone';
import { availableFor } from '../product/stock';
import { QUICK_ORDER_TTL } from './throttling';

const QUICK_ORDER_TTL_MS = QUICK_ORDER_TTL;

@Injectable()
export class QuickOrderService {
  constructor(
    @InjectRepository(QuickOrderEntity)
    private repository: Repository<QuickOrderEntity>,
    private productService: ProductService,
  ) {}

  async create({ phoneNumber, productId, size }: CreateQuickOrderDto) {
    const product = await this.productService.findByIdWithStock(productId);
    if (!product || product.status === ProductStatus.Hidden) {
      throw new NotFoundException(null, 'Товар не знайдено');
    }
    if (product.count !== null && product.count <= 0) {
      throw new BadRequestException('Товару немає в наявності');
    }
    const [fullProduct] = await this.productService.findProductsMain([productId]);

    // Якщо в товару є розміри, клієнт мусить обрати один із них
    if (product.sizes?.length) {
      if (!size) {
        throw new BadRequestException('Оберіть розмір товару');
      }
      if (!product.sizes.includes(size)) {
        throw new BadRequestException('Такого розміру немає в цього товару');
      }
    }
    if (availableFor(product, size) === 0) {
      throw new BadRequestException(
        size ? `Розміру ${size} немає в наявності` : 'Товару немає в наявності',
      );
    }

    const normalizedPhone = normalizePhone(phoneNumber) as string;
    const sizeOrNull = size ?? null;

    // Повторне натискання «Замовити» не повинно створювати дублікат заявки
    const existing = await this.repository.findOne({
      where: {
        phoneNumber: normalizedPhone,
        product: { id: productId },
        size: sizeOrNull,
        createdAt: MoreThan(new Date(Date.now() - QUICK_ORDER_TTL_MS)),
      },
      order: { createdAt: 'DESC' },
    });
    if (existing) {
      return { id: existing.id, createdAt: existing.createdAt };
    }

    const { id, createdAt } = await this.repository.save({
      phoneNumber: normalizedPhone,
      product: fullProduct,
      size: sizeOrNull,
    });
    return { id, createdAt };
  }

  // Нові заявки першими
  findAll() {
    return this.repository.find({
      relations: ['product'],
      order: { createdAt: 'DESC' },
    });
  }

  async remove(id: number) {
    const { affected } = await this.repository.delete(id);
    if (!affected) {
      throw new NotFoundException(null, 'Заявку не знайдено');
    }
    return 'Заявку видалено';
  }
}
