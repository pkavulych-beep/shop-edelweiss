import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProductModule } from '../product/product.module';
import { QuickOrderEntity } from './entities/quick-order.entity';
import { QuickOrderController } from './quick-order.controller';
import { QuickOrderService } from './quick-order.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([QuickOrderEntity]),
    forwardRef(() => AuthModule),
    ProductModule,
  ],
  controllers: [QuickOrderController],
  providers: [QuickOrderService],
})
export class QuickOrderModule {}
