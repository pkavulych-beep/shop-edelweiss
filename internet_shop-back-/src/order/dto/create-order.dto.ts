import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateOrderDto {
  @IsArray({ message: 'Товари мають бути передані списком' })
  @ArrayNotEmpty({ message: 'Не вказано товари' })
  @IsInt({ each: true, message: 'Кожен ідентифікатор товару має бути цілим числом' })
  productId: number[];

  @IsOptional()
  @IsString({ message: 'Коментар має бути рядком' })
  comment?: string;

  @IsString({ message: 'Місто має бути рядком' })
  @IsNotEmpty({ message: 'Вкажіть місто доставки' })
  cityName: string;

  @IsString({ message: 'Відділення має бути рядком' })
  @IsNotEmpty({ message: 'Вкажіть відділення доставки' })
  department: string;

  @IsOptional()
  @IsString({ message: 'Розмір має бути рядком' })
  size?: string;
}
