import { IsNotEmpty, IsOptional, IsEnum, IsArray, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { Gender, Category, Season, ProductStatus } from '../entities/product.entity';

export class CreateProductDto {
  @IsNotEmpty({ message: 'Вкажіть назву товару' })
  name: string;

  @IsOptional()
  count: number;

  @IsNotEmpty({ message: 'Вкажіть опис товару' })
  description: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) return value.split(',').map((s) => s.trim()).filter(Boolean);
    return [];
  })
  @IsArray({ message: 'Розміри мають бути списком' })
  sizes: string[];

  @IsOptional()
  weight: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) return value.split(',').map((s) => s.trim()).filter(Boolean);
    return [];
  })
  @IsArray({ message: 'Кольори мають бути списком' })
  colors: string[];

  @IsOptional()
  material: string;

  @IsNotEmpty({ message: 'Вкажіть ціну' })
  price: number;

  @IsOptional()
  salePrice: number;

  @IsNotEmpty({ message: 'Оберіть стать' })
  @IsEnum(Gender, { message: 'Неправильне значення статі' })
  gender: Gender;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(Category, { message: 'Неправильна категорія' })
  category: Category;

  @IsOptional()
  @IsString({ message: 'Підкатегорія має бути рядком' })
  subcategory: string;

  @IsOptional()
  @IsString({ message: 'Бренд має бути рядком' })
  brand: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(Season, { message: 'Неправильний сезон' })
  season: Season;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(ProductStatus, { message: 'Неправильний статус товару' })
  status: ProductStatus;
}
