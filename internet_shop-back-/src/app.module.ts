import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { ProductModule } from './product/product.module';
import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { FileModule } from './file/file.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { PhotosModule } from './photos/photos.module';
import { OrderModule } from './order/order.module';
import { getUploadsDir } from './file/uploads-dir';
import { getDataSourceOptions } from './database/data-source-options';
import { QuickOrderModule } from './quick-order/quick-order.module';
import { PaymentModule } from './payment/payment.module';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  AUTH_ATTEMPTS_LIMIT,
  AUTH_ATTEMPTS_TTL,
  TOO_MANY_ATTEMPTS_MESSAGE,
} from './auth/throttling';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          limit: AUTH_ATTEMPTS_LIMIT,
          ttl: AUTH_ATTEMPTS_TTL,
        },
      ],
      errorMessage: TOO_MANY_ATTEMPTS_MESSAGE,
    }),
    ServeStaticModule.forRoot({
      rootPath: getUploadsDir(),
    }),
    TypeOrmModule.forRoot(getDataSourceOptions()),
    UserModule,
    ProductModule,
    AuthModule,
    RolesModule,
    FileModule,
    PhotosModule,
    OrderModule,
    QuickOrderModule,
    PaymentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
