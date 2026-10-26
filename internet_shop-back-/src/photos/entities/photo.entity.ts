import { Transform } from 'class-transformer';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { ProductEntity } from '../../product/entities/product.entity';
import { toPublicFileUrl } from '../../file/public-url';

@Entity()
export class PhotoEntity {
  @PrimaryGeneratedColumn()
  id: number;

  // У базі відносний шлях; у JSON — повний URL із поточного BASE_URL
  @Column()
  @Transform(({ value }) => toPublicFileUrl(value), { toPlainOnly: true })
  url: string;

  @ManyToOne(() => ProductEntity, (product) => product.photos)
  product: ProductEntity;
}
