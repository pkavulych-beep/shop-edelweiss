import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { OrderItemDto } from './order-item.dto';

export class CreateOrderDto {
  @IsArray({ message: 'Позиції замовлення мають бути передані списком' })
  @ArrayNotEmpty({ message: 'Не вказано товари' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

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
