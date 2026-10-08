import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  Equal,
  In,
  IsNull,
  MoreThan,
  Not,
  Or,
  Repository,
} from 'typeorm';
import { ProductEntity, ProductStatus } from './entities/product.entity';
import { BasketItemEntity } from '../user/entities/basket-item.entity';
import { baseUrl, FileService, FileType } from 'src/file/file.service';
import { PhotosService } from '../photos/photos.service';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(ProductEntity)
    private repository: Repository<ProductEntity>,
    @InjectRepository(BasketItemEntity)
    private basketRepository: Repository<BasketItemEntity>,
    private fileService: FileService,
    private photosService: PhotosService,
  ) {}

  async create(createProductDto: CreateProductDto, photos) {
    const createFile = (photoFile) =>
      this.fileService.createFile(FileType.IMAGE, photoFile);

    const coverUrl = createFile(photos[0]);

    const picturePathArr = [];
    if (photos.length > 1) {
      for (let i = 1; i < photos.length; i++) {
        const photoUrl = createFile(photos[i]);
        const res = await this.photosService.create({ url: photoUrl });
        picturePathArr.push(res);
      }
    }

    // Обробити sizes/colors якщо прийшли як строки (з FormData)
    const dto = { ...createProductDto };
    if (typeof dto.sizes === 'string') {
      dto.sizes = (dto.sizes as string).split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (typeof dto.colors === 'string') {
      dto.colors = (dto.colors as string).split(',').map((s) => s.trim()).filter(Boolean);
    }

    return this.repository.save({
      cover: coverUrl,
      photos: photos.length > 1 ? picturePathArr : null,
      status: ProductStatus.Active,
      ...dto,
    });
  }

  // Новий метод фільтрації з QueryBuilder
  async findFiltered(
    filters: FilterProductDto,
  ): Promise<{ data: ProductEntity[]; total: number }> {
    const qb = this.repository.createQueryBuilder('product');

    // Показувати тільки активні товари (або без статусу — для зворотної сумісності)
    qb.andWhere('(product.status = :status OR product.status IS NULL)', { status: ProductStatus.Active });

    if (filters.gender) {
      qb.andWhere('product.gender IN (:...genders)', {
        genders: [filters.gender, 'unisex'],
      });
    }

    if (filters.category) {
      const categories = filters.category.split(',').map((c) => c.trim());
      qb.andWhere('product.category IN (:...categories)', { categories });
    }

    if (filters.subcategory) {
      qb.andWhere('product.subcategory = :subcategory', {
        subcategory: filters.subcategory,
      });
    }

    if (filters.brand) {
      const brands = filters.brand.split(',').map((b) => b.trim());
      qb.andWhere('product.brand IN (:...brands)', { brands });
    }

    if (filters.color) {
      const colors = filters.color.split(',').map((c) => c.trim());
      const colorConditions = colors.map(
        (_, i) => `product.colors @> ARRAY[:color${i}]::text[]`,
      );
      colors.forEach((c, i) => qb.setParameter(`color${i}`, c));
      qb.andWhere(`(${colorConditions.join(' OR ')})`);
    }

    if (filters.size) {
      const sizes = filters.size.split(',').map((s) => s.trim());
      const sizeConditions = sizes.map(
        (_, i) => `product.sizes @> ARRAY[:size${i}]::text[]`,
      );
      sizes.forEach((s, i) => qb.setParameter(`size${i}`, s));
      qb.andWhere(`(${sizeConditions.join(' OR ')})`);
    }

    if (filters.material) {
      qb.andWhere('product.material = :material', {
        material: filters.material,
      });
    }

    if (filters.season) {
      const seasons = filters.season.split(',').map((s) => s.trim());
      qb.andWhere('product.season IN (:...seasons)', { seasons });
    }

    if (filters.priceMin != null) {
      qb.andWhere(
        'COALESCE(NULLIF(product.salePrice, 0), product.price) >= :priceMin',
        { priceMin: filters.priceMin },
      );
    }

    if (filters.priceMax != null) {
      qb.andWhere(
        'COALESCE(NULLIF(product.salePrice, 0), product.price) <= :priceMax',
        { priceMax: filters.priceMax },
      );
    }

    if (filters.onSale) {
      qb.andWhere('product.salePrice IS NOT NULL AND product.salePrice > 0');
    }

    if (filters.search) {
      qb.andWhere(
        '(product.name ILIKE :search OR product.description ILIKE :search OR product.brand ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Сортування
    switch (filters.sort) {
      case 'price_asc':
        qb.orderBy(
          'COALESCE(NULLIF(product.salePrice, 0), product.price)',
          'ASC',
        );
        break;
      case 'price_desc':
        qb.orderBy(
          'COALESCE(NULLIF(product.salePrice, 0), product.price)',
          'DESC',
        );
        break;
      case 'newest':
        qb.orderBy('product.createdAt', 'DESC');
        break;
      default:
        qb.orderBy('product.createdAt', 'DESC');
    }

    // Пагінація
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findDiscounts(gender): Promise<ProductEntity[]> {
    if (gender) {
      return await this.repository.findBy({
        salePrice: MoreThan(0),
        gender: Equal(gender),
        status: Or(Not(ProductStatus.Hidden), IsNull()),
      });
    } else {
      return await this.repository.findBy({
        salePrice: MoreThan(0),
        status: Or(Not(ProductStatus.Hidden), IsNull()),
      });
    }
  }

  async findOne(id: number): Promise<ProductEntity> {
    const commodity = await this.repository.findOne({
      where: { id },
      relations: ['photos'],
    });
    // Прихований («видалений») товар не віддаємо за прямим посиланням
    if (!commodity || commodity.status === ProductStatus.Hidden) {
      throw new NotFoundException(null, 'Товар не знайдено');
    }
    return commodity;
  }

  // Id товарів, які існують і не приховані, тобто їх можна купити
  async findPurchasableIds(ids: number[]): Promise<number[]> {
    const products = await this.findPurchasable(ids);
    return products.map((product) => product.id);
  }

  // Товари, які існують і не приховані, з даними для розрахунку замовлення
  async findPurchasable(ids: number[]): Promise<ProductEntity[]> {
    if (!ids || ids.length === 0) return [];
    return this.repository.find({
      where: {
        id: In(ids),
        status: Or(Not(ProductStatus.Hidden), IsNull()),
      },
      select: ['id', 'sizes', 'price', 'salePrice'],
    });
  }

  async assertPurchasable(ids: number[]): Promise<void> {
    const purchasable = new Set(await this.findPurchasableIds(ids));
    if (ids.some((id) => !purchasable.has(+id))) {
      throw new NotFoundException(null, 'Товар не знайдено');
    }
  }

  // Основні поля товарів одним запитом; якщо якогось id немає, кидає 404.
  // manager передають, щоб читати в межах транзакції замовлення
  async findProductsMain(
    ids: number[],
    manager: EntityManager = this.repository.manager,
  ): Promise<ProductEntity[]> {
    const uniqueIds = [...new Set((ids ?? []).map(Number))];
    if (uniqueIds.length === 0) return [];
    const products = await manager.find(ProductEntity, {
      where: { id: In(uniqueIds) },
      select: ['id', 'name', 'sizes', 'price', 'cover', 'salePrice'],
    });
    if (products.length !== uniqueIds.length) {
      throw new NotFoundException(null, 'Товар не знайдено');
    }
    return products;
  }

  async findByIds(ids: number[]): Promise<ProductEntity[]> {
    if (!ids || ids.length === 0) return [];
    return this.repository.find({
      where: { id: In(ids) },
      select: ['id', 'name', 'sizes', 'price', 'cover', 'salePrice'],
    });
  }

  async findOnlyPhotos(id: number) {
    try {
      const commodity = await this.repository.findOne({
        where: { id },
        relations: ['photos'],
      });
      const { photos } = commodity;
      return photos;
    } catch (e) {
      throw new NotFoundException(null, 'Товар не знайдено');
    }
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
    const product = await this.repository.findOne({ where: { id } });
    if (product) {
      // Обробити sizes/colors якщо прийшли як строки
      const dto = { ...updateProductDto };
      if (typeof dto.sizes === 'string') {
        dto.sizes = (dto.sizes as string).split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (typeof dto.colors === 'string') {
        dto.colors = (dto.colors as string).split(',').map((s) => s.trim()).filter(Boolean);
      }
      await this.repository.update(id, {
        ...dto,
        updateAt: new Date(),
      });
      return this.repository.findOne({ where: { id } });
    } else {
      throw new NotFoundException(null, 'Товар не знайдено');
    }
  }

  async remove(id: number) {
    const product = await this.repository.findOne({
      where: { id },
      relations: ['photos'],
    });

    if (!product) {
      throw new NotFoundException(null, 'Товар не знайдено');
    }

    await this.basketRepository.delete({ productId: id });

    // Товар є в замовленнях — ховаємо його, щоб не зламати історію замовлень
    // (фото теж залишаємо: обкладинка потрібна для відображення замовлення)
    const ordersCount = await this.repository
      .createQueryBuilder('product')
      .innerJoin('product.orderItems', 'item')
      .where('product.id = :id', { id })
      .getCount();

    if (ordersCount > 0) {
      await this.repository.update(id, { status: ProductStatus.Hidden });
      return 'Товар є в замовленнях, тому його приховано з каталогу';
    }

    try {
      await this.fileService.deleteFile(
        product.cover.replace(baseUrl, ''),
      );
    } catch (e) {
      console.warn('Cover file not found, skipping:', e.message);
    }

    if (product.photos) {
      for (const photo of product.photos) {
        try {
          await this.fileService.deleteFile(
            photo.url.replace(baseUrl, ''),
          );
        } catch (e) {
          console.warn('Photo file not found, skipping:', e.message);
        }
        await this.photosService.remove(photo.id);
      }
    }

    await this.repository.delete(id);
    return 'Товар був успішно видалений';
  }
}
