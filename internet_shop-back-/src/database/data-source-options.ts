import * as path from 'path';
import { DataSourceOptions } from 'typeorm';
import { UserEntity } from '../user/entities/user.entity';
import { ProductEntity } from '../product/entities/product.entity';
import { RoleEntity } from '../roles/entities/roles.entity';
import { PhotoEntity } from '../photos/entities/photo.entity';
import { OrderEntity } from '../order/entities/order.entity';
import { OrderItemEntity } from '../order/entities/order-item.entity';
import { BasketItemEntity } from '../user/entities/basket-item.entity';
import { QuickOrderEntity } from '../quick-order/entities/quick-order.entity';
import { RefreshTokenEntity } from '../auth/entities/refresh-token.entity';
import { PaymentEntity } from '../payment/entities/payment.entity';

export const ENTITIES = [
  UserEntity,
  ProductEntity,
  RoleEntity,
  PhotoEntity,
  OrderEntity,
  OrderItemEntity,
  BasketItemEntity,
  QuickOrderEntity,
  RefreshTokenEntity,
  PaymentEntity,
];

// Міграції лежать у `src/migrations` і компілюються разом із застосунком у `dist/migrations`.
// `*.{ts,js}` підходить і для ts-node (CLI typeorm), і для зібраного `dist`; `.d.ts` typeorm пропускає сам.
export const MIGRATIONS = [path.join(__dirname, '..', 'migrations', '*.{ts,js}')];

// Спільні налаштування бази для застосунку (app.module.ts) і CLI typeorm (db/data-source.ts).
// Локально схему підганяє `synchronize`, а з NODE_ENV=production її створюють лише міграції,
// які застосовуються під час старту.
export function getDataSourceOptions(env: NodeJS.ProcessEnv = process.env): DataSourceOptions {
  const production = env.NODE_ENV === 'production';
  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: Number(env.DB_PORT) || 5432,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    synchronize: !production,
    migrationsRun: production,
  };
}
