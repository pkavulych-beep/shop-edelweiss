import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateOrderDto } from './create-order.dto';
import { IsNotEmpty, IsOptional } from 'class-validator';
import { Status } from '../statusEnum';

// Позиції замовлення фіксуються під час покупки, тож тут їх не змінюють
export class UpdateOrderDto extends PartialType(
  OmitType(CreateOrderDto, ['items'] as const),
) {
  @IsNotEmpty({ message: 'Не вказано замовлення' })
  id: number;

  @IsOptional()
  status: Status;

  @IsOptional()
  comment: string;
}
