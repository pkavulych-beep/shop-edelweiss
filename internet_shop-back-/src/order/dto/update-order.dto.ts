import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateOrderDto } from './create-order.dto';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { Status, statusMessage } from '../statusEnum';

// Позиції замовлення фіксуються під час покупки, тож тут їх не змінюють
export class UpdateOrderDto extends PartialType(OmitType(CreateOrderDto, ['items'] as const)) {
  @IsInt({ message: 'Не вказано замовлення' })
  id: number;

  @IsOptional()
  @IsEnum(Status, { message: statusMessage })
  status?: Status;
}
