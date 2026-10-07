import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserEntity } from './user/entities/user.entity';
import { UserModule } from './user/user.module';
import { ProductModule } from './product/product.module';
import { ProductEntity } from './product/entities/product.entity';
import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { RoleEntity } from './roles/entities/roles.entity';
import { FileModule } from './file/file.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { PhotosModule } from './photos/photos.module';
import { PhotoEntity } from './photos/entities/photo.entity';
import { OrderModule } from './order/order.module';
import { OrderEntity } from './order/entities/order.entity';
import { OrderItemEntity } from './order/entities/order-item.entity';
import { BasketItemEntity } from './user/entities/basket-item.entity';
import { getUploadsDir } from './file/uploads-dir';
import { QuickOrderModule } from './quick-order/quick-order.module';
import { QuickOrderEntity } from './quick-order/entities/quick-order.entity';
import { RefreshTokenEntity } from './auth/entities/refresh-token.entity';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: getUploadsDir(),
    }),
    TypeOrmModule.forRoot({
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
    }),
    UserModule,
    ProductModule,
    AuthModule,
    RolesModule,
    FileModule,
    PhotosModule,
    OrderModule,
    QuickOrderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
