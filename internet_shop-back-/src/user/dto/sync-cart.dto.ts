import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncCartItemDto {
  @IsNotEmpty({ message: 'Не вказано товар' })
  @IsNumber({}, { message: 'Ідентифікатор товару має бути числом' })
  productId: number;

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
