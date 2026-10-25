import {
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsString,
  IsInt,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Gender, Category, Season, ProductStatus } from '../entities/product.entity';

// Створення товару йде через FormData, де числа приходять рядками ("1000"),
// тому рядки конвертуємо у числа. Решту значень не чіпаємо: нечислові дані
// відкине валідація зі зрозумілим повідомленням, а не база даних із 500.
const toNumber = ({ value }) =>
  typeof value === 'string' && value.trim() !== ''
    ? Number(value.trim())
    : value;

export class CreateProductDto {
  @IsNotEmpty({ message: 'Вкажіть назву товару' })
  name: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt({ message: 'Кількість має бути цілим числом' })
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
  @Transform(toNumber)
  @IsInt({ message: 'Ціна має бути цілим числом' })
  price: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt({ message: 'Ціна зі знижкою має бути цілим числом' })
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
