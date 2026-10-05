import { OrderEntity } from 'src/order/entities/order.entity';
import { RoleEntity } from 'src/roles/entities/roles.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { BasketItemEntity } from './basket-item.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fullName: string;

  @Column({ nullable: true, unique: true })
  email?: string;

  @Column({ unique: true })
  phoneNumber: string;

  // Хеш bcrypt; не вибирається за замовчуванням, а якщо його все ж вибрали,
  // ClassSerializerInterceptor (див. main.ts) не віддасть його у відповіді API
  @Exclude({ toPlainOnly: true })
  @Column({ select: false })
  password: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updateAt: Date;

  @ManyToMany(() => RoleEntity)
  @JoinTable()
  roles: RoleEntity[];

  @OneToMany(() => BasketItemEntity, (item) => item.user)
  cartItems: BasketItemEntity[];

  @OneToMany(() => OrderEntity, (order) => order.user)
  orders: OrderEntity[];
}
