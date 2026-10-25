import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateOrderDto } from './create-order.dto';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  Validate,
  ValidateIf,
} from 'class-validator';
import { Status, statusMessage } from '../statusEnum';
import { MAX_INT } from '../../common/constants';
import { IsUkrposhtaIndexConstraint } from './ukrposhta-index.validator';

// Позиції замовлення фіксуються під час покупки, тож тут їх не змінюють.
// cityName і department оголошуємо окремо: PartialType додав би до них
// @IsOptional, який пропускає null, і він потрапляв би в NOT NULL колонку (500)
export class UpdateOrderDto extends PartialType(
  OmitType(CreateOrderDto, ['items', 'cityName', 'department'] as const),
) {
  @IsInt({ message: 'Не вказано замовлення' })
  @Min(1, { message: 'Ідентифікатор замовлення має бути більшим за 0' })
  @Max(MAX_INT, { message: 'Ідентифікатор замовлення занадто великий' })
  id: number;

  @IsOptional()
  @IsEnum(Status, { message: statusMessage })
  status?: Status;

  // Необов'язкові для часткового PATCH, але null — це спроба стерти
  // обов'язкове поле, тож валідація має повернути 400, як для порожнього рядка
  @ValidateIf((_, value) => value !== undefined)
  @IsString({ message: 'Місто має бути рядком' })
  @IsNotEmpty({ message: 'Вкажіть місто доставки' })
  cityName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString({ message: 'Відділення має бути рядком' })
  @IsNotEmpty({ message: 'Вкажіть відділення доставки' })
  @Validate(IsUkrposhtaIndexConstraint)
  department?: string;
}
