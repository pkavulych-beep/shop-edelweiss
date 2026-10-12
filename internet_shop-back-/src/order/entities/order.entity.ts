import { UserEntity } from 'src/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Status } from '../statusEnum';
import { PaymentMethod, PaymentStatus } from '../paymentEnum';
import { OrderItemEntity } from './order-item.entity';

@Entity('order')
export class OrderEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => UserEntity, (user) => user.orders)
  user: UserEntity;

  @OneToMany(() => OrderItemEntity, (item) => item.order, { cascade: ['insert'] })
  items?: OrderItemEntity[];

  // Сума замовлення, порахована на бекенді з цін позицій
  @Column({ default: 0 })
  total: number;

  @Column()
  status: Status;

  // Оплата має власну вісь станів, окрему від статусу виконання (status)
  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.Cod })
  paymentMethod: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.NotRequired })
  paymentStatus: PaymentStatus;

  // id інвойсу провайдера, nullable: заповнюється лише для онлайн-оплати
  @Column({ nullable: true })
  paymentInvoiceId: string;

  // timestamptz: база в UTC, як і createdAt
  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date;

  @Column({ nullable: true })
  comment: string;

  @Column()
  cityName: string;

  @Column()
  department: string;

  // timestamptz: база в UTC, без поясу дата зсувалася б на різницю часу
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
