import { IsArray, IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncCartItemDto {
  @IsNotEmpty({ message: 'Не вказано товар' })
  @IsNumber({}, { message: 'Ідентифікатор товару має бути числом' })
  productId: number;

  @IsNotEmpty({ message: 'Оберіть розмір' })
  @IsString({ message: 'Розмір має бути рядком' })
  size: string;

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
