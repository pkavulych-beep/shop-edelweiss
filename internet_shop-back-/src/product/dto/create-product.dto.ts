import { IsNotEmpty, IsOptional, IsEnum, IsArray, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { Gender, Category, Season, ProductStatus } from '../entities/product.entity';

export class CreateProductDto {
  @IsNotEmpty()
  name: string;

  @IsOptional()
  count: number;

  @IsNotEmpty()
  description: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) return value.split(',').map((s) => s.trim()).filter(Boolean);
    return [];
  })
  @IsArray()
  sizes: string[];

  @IsOptional()
  weight: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) return value.split(',').map((s) => s.trim()).filter(Boolean);
    return [];
  })
  @IsArray()
  colors: string[];

  @IsOptional()
  material: string;

  @IsNotEmpty()
  price: number;

  @IsOptional()
  salePrice: number;

  @IsNotEmpty({ message: 'Оберіть стать' })
  @IsEnum(Gender, { message: 'Невірне значення статі' })
  gender: Gender;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(Category, { message: 'Невірна категорія' })
  category: Category;

  @IsOptional()
  @IsString()
  subcategory: string;

  @IsOptional()
  @IsString()
  brand: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(Season, { message: 'Невірний сезон' })
  season: Season;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEnum(ProductStatus)
  status: ProductStatus;
}
