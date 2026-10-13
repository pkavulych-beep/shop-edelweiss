import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentEntity } from './entities/payment.entity';
import { OrderEntity } from '../order/entities/order.entity';
import { OrderModule } from '../order/order.module';
import { MonoPaymentProvider } from './providers/mono.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity, OrderEntity]),
    forwardRef(() => OrderModule),
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    {
      provide: 'PAYMENT_PROVIDER',
      useClass: MonoPaymentProvider,
    },
    MonoPaymentProvider,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}