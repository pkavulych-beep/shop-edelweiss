import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { OrderItemDto } from './order-item.dto';
import { PaymentMethod, paymentMethodMessage } from '../paymentEnum';

export class CreateOrderDto {
  @IsArray({ message: 'Позиції замовлення мають бути передані списком' })
  @ArrayNotEmpty({ message: 'Не вказано товари' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  // Клієнт обирає лише спосіб оплати. paymentStatus, paymentInvoiceId і paidAt
  // задає бекенд (провайдер оплати), тож у DTO їх немає і whitelist їх відкидає
  @IsOptional()
  @IsEnum(PaymentMethod, { message: paymentMethodMessage })
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString({ message: 'Коментар має бути рядком' })
  comment?: string;

  @IsString({ message: 'Місто має бути рядком' })
  @IsNotEmpty({ message: 'Вкажіть місто доставки' })
  cityName: string;

  @IsString({ message: 'Відділення має бути рядком' })
  @IsNotEmpty({ message: 'Вкажіть відділення доставки' })
  department: string;
}
