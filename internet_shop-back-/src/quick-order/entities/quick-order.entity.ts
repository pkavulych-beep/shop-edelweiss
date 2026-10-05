import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ProductEntity } from '../../product/entities/product.entity';

// Заявка «Замовити в 1 клік»: менеджер передзвонює клієнту й оформлює замовлення
@Entity('quick_order')
export class QuickOrderEntity {
  @PrimaryGeneratedColumn()
  id: number;

  // У форматі 380XXXXXXXXX
  @Column()
  phoneNumber: string;

  // SET NULL: якщо товар видалять, заявка з телефоном клієнта не зникне
  @ManyToOne(() => ProductEntity, { nullable: true, onDelete: 'SET NULL' })
  product: ProductEntity | null;

  @Column({ nullable: true })
  size: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
