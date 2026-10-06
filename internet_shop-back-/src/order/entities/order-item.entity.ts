import { ProductEntity } from '../../product/entities/product.entity';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrderEntity } from './order.entity';

// Позиція замовлення: товар у конкретному розмірі, кількість і ціна за одиницю
// на момент покупки (ціна товару потім може змінитися)
@Entity('order_item')
export class OrderItemEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => OrderEntity, (order) => order.items, { onDelete: 'CASCADE' })
  order: OrderEntity;

  // RESTRICT: товар, що є в замовленнях, не можна видалити фізично —
  // інакше він зникне з історії замовлень (див. ProductService.remove)
  @ManyToOne(() => ProductEntity, (product) => product.orderItems, {
    onDelete: 'RESTRICT',
  })
  product: ProductEntity;

  @Column()
  productId: number;

  @Column()
  size: string;

  @Column()
  quantity: number;

  @Column()
  price: number;
}
