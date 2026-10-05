import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductService } from '../product/product.service';
import { CreateQuickOrderDto } from './dto/create-quick-order.dto';
import { QuickOrderEntity } from './entities/quick-order.entity';

@Injectable()
export class QuickOrderService {
  constructor(
    @InjectRepository(QuickOrderEntity)
    private repository: Repository<QuickOrderEntity>,
    private productService: ProductService,
  ) {}

  async create({ phoneNumber, productId, size }: CreateQuickOrderDto) {
    await this.productService.assertPurchasable([productId]);
    const [product] = await this.productService.findProductsMain([productId]);

    // Якщо в товару є розміри, клієнт мусить обрати один із них
    if (product.sizes?.length) {
      if (!size) {
        throw new BadRequestException('Оберіть розмір товару');
      }
      if (!product.sizes.includes(size)) {
        throw new BadRequestException('Такого розміру немає в цього товару');
      }
    }

    const { id, createdAt } = await this.repository.save({
      phoneNumber,
      product,
      size: size ?? null,
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
