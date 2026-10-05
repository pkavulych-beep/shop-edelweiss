import { ProductEntity } from 'src/product/entities/product.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Status } from '../statusEnum';

@Entity('order')
export class OrderEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => UserEntity, (user) => user.orders)
  user: UserEntity;

  @ManyToMany(() => ProductEntity, (product) => product.orders)
  @JoinTable({ name: 'productsInOrder' })
  productsInOrder?: ProductEntity[];

  @Column()
  status: Status;

  @Column({ nullable: true })
  comment: string;

  @Column()
  cityName: string;

  @Column()
  department: string;

  // Розмір має зберігатися в позиції замовлення (#9), поки що необов'язковий
  @Column({ nullable: true })
  size: string;
}
