import { IsOptional, IsEnum, IsString, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { Gender } from '../entities/product.entity';

export class FilterProductDto {
  @IsOptional()
  @IsEnum(Gender, { message: 'Неправильне значення статі' })
  gender?: Gender;

  @IsOptional()
  @IsString({ message: 'Категорія має бути рядком' })
  category?: string;

  @IsOptional()
  @IsString({ message: 'Підкатегорія має бути рядком' })
  subcategory?: string;

  @IsOptional()
  @IsString({ message: 'Бренд має бути рядком' })
  brand?: string;

  @IsOptional()
  @IsString({ message: 'Колір має бути рядком' })
  color?: string;

  @IsOptional()
  @IsString({ message: 'Розмір має бути рядком' })
  size?: string;

  @IsOptional()
  @IsString({ message: 'Матеріал має бути рядком' })
  material?: string;

  @IsOptional()
  @IsString({ message: 'Сезон має бути рядком' })
  season?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Мінімальна ціна має бути числом' })
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Максимальна ціна має бути числом' })
  priceMax?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'Фільтр знижок має бути true або false' })
  onSale?: boolean;

  @IsOptional()
  @IsString({ message: 'Пошуковий запит має бути рядком' })
  search?: string;

  @IsOptional()
  @IsString({ message: 'Сортування має бути рядком' })
  sort?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Номер сторінки має бути числом' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Кількість товарів на сторінці має бути числом' })
  limit?: number;
}
