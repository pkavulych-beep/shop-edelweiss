import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { ProductEntity } from '../../product/entities/product.entity';

@Entity('basket_items')
export class BasketItemEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => UserEntity, (user) => user.cartItems, {
    onDelete: 'CASCADE',
  })
  user: UserEntity;

  @Column()
  userId: number;

  @ManyToOne(() => ProductEntity, { eager: true })
  product: ProductEntity;

  @Column()
  productId: number;

  @Column()
  size: string;

  @Column({ default: 1 })
  quantity: number;
}
