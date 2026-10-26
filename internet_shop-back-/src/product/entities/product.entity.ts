import { Transform } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PhotoEntity } from '../../photos/entities/photo.entity';
import { OrderItemEntity } from '../../order/entities/order-item.entity';
import { toPublicFileUrl } from '../../file/public-url';

export enum Gender {
  Man = 'man',
  Woman = 'woman',
  Unisex = 'unisex',
}

export enum Category {
  Outerwear = 'outerwear',
  Pants = 'pants',
  Tshirts = 'tshirts',
  Shirts = 'shirts',
  Hoodies = 'hoodies',
  Dresses = 'dresses',
  Skirts = 'skirts',
  Shoes = 'shoes',
  Accessories = 'accessories',
  Sportswear = 'sportswear',
  Underwear = 'underwear',
}

export enum Season {
  AllSeason = 'all-season',
  SpringSummer = 'spring-summer',
  AutumnWinter = 'autumn-winter',
}

export enum ProductStatus {
  Active = 'active',
  Hidden = 'hidden',
  OutOfStock = 'out-of-stock',
}

@Entity('product')
export class ProductEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  // У базі відносний шлях; у JSON — повний URL із поточного BASE_URL
  @Column({ nullable: true })
  @Transform(({ value }) => toPublicFileUrl(value), { toPlainOnly: true })
  cover: string;

  @OneToMany(() => PhotoEntity, (photo) => photo.product)
  photos: PhotoEntity[];

  // Позиції замовлень із цим товаром (FK з RESTRICT, див. OrderItemEntity)
  @OneToMany(() => OrderItemEntity, (item) => item.product)
  orderItems?: OrderItemEntity[];

  @Column({ nullable: true })
  count: number;

  @Column()
  description: string;

  @Column('text', { array: true, default: '{}' })
  sizes: string[];

  // Залишок по розмірах ({"S": 3, "M": 0}); тоді sizes — його ключі, а count —
  // сума. NULL — товар без розмірів, залишок лише в count. Тип json, а не
  // jsonb: jsonb сортує ключі, а порядок розмірів задає адмін
  @Column({ type: 'json', nullable: true, default: null })
  sizeStock: Record<string, number> | null;

  @Column({ nullable: true })
  weight: string;

  @Column('text', { array: true, nullable: true, default: '{}' })
  colors: string[];

  @Column({ nullable: true })
  material: string;

  @Column()
  price: number;

  @Column({ nullable: true })
  salePrice: number;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender;

  @Column({ type: 'enum', enum: Category, nullable: true })
  category: Category;

  @Column({ nullable: true })
  subcategory: string;

  @Column({ nullable: true })
  brand: string;

  @Column({ type: 'enum', enum: Season, default: Season.AllSeason })
  season: Season;

  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.Active })
  status: ProductStatus;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updateAt: Date;
}
