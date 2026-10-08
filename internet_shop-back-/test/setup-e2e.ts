import 'dotenv/config';
import { DataSource } from 'typeorm';
import { UserEntity } from '../src/user/entities/user.entity';
import { ProductEntity } from '../src/product/entities/product.entity';
import { RoleEntity } from '../src/roles/entities/roles.entity';
import { PhotoEntity } from '../src/photos/entities/photo.entity';
import { OrderEntity } from '../src/order/entities/order.entity';
import { OrderItemEntity } from '../src/order/entities/order-item.entity';
import { BasketItemEntity } from '../src/user/entities/basket-item.entity';
import { QuickOrderEntity } from '../src/quick-order/entities/quick-order.entity';
import { RefreshTokenEntity } from '../src/auth/entities/refresh-token.entity';

export const e2eDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [
    UserEntity,
    ProductEntity,
    RoleEntity,
    PhotoEntity,
    OrderEntity,
    OrderItemEntity,
    BasketItemEntity,
    QuickOrderEntity,
    RefreshTokenEntity,
  ],
  synchronize: true,
});