import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateOrderDto } from './create-order.dto';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Status, statusMessage } from '../statusEnum';
import { MAX_INT } from '../../common/constants';

// Позиції замовлення фіксуються під час покупки, тож тут їх не змінюють
export class UpdateOrderDto extends PartialType(OmitType(CreateOrderDto, ['items'] as const)) {
  @IsInt({ message: 'Не вказано замовлення' })
  @Min(1, { message: 'Ідентифікатор замовлення має бути більшим за 0' })
  @Max(MAX_INT, { message: 'Ідентифікатор замовлення занадто великий' })
  id: number;

  @IsOptional()
  @IsEnum(Status, { message: statusMessage })
  status?: Status;
}
