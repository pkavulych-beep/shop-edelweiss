import { IsArray, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { MAX_INT } from '../../common/constants';

export class SyncCartItemDto {
  @IsNotEmpty({ message: 'Не вказано товар' })
  @IsInt({ message: 'Ідентифікатор товару має бути цілим числом' })
  @Min(1, { message: 'Ідентифікатор товару має бути більшим за 0' })
  @Max(MAX_INT, { message: 'Ідентифікатор товару занадто великий' })
  productId: number;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString({ message: 'Розмір має бути рядком' })
  @IsNotEmpty({ message: 'Розмір не може бути порожнім' })
  size?: string;

  @IsNotEmpty({ message: 'Вкажіть кількість' })
  @IsNumber({}, { message: 'Кількість має бути числом' })
  quantity: number;
}

export class SyncCartDto {
  @IsArray({ message: 'Товари мають бути передані списком' })
  @ValidateNested({ each: true, message: 'Некоректні дані товару в кошику' })
  @Type(() => SyncCartItemDto)
  items: SyncCartItemDto[];
}
