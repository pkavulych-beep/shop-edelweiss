import {
  IsOptional,
  IsEnum,
  IsString,
  IsNumber,
  IsBoolean,
  IsInt,
  Min,
  Max,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Gender, Category, Season } from '../entities/product.entity';

// Фільтри можуть прийти списком через кому (category=dress,hoodies), тому для
// enum-колонок перевіряємо кожен елемент списку, а не весь рядок.
function IsEnumEach(
  entity: object,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isEnumEach',
      target: object.constructor,
      propertyName,
      constraints: [entity],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (value === undefined || value === '') {
            return true;
          }
          const allowed = Object.values(args.constraints[0] as object);
          return String(value)
            .split(',')
            .every((item) => allowed.includes(item.trim()));
        },
      },
    });
  };
}

// Порожній параметр у query означає, що його немає. @Transform виконується після
// @Type, а Number('') === 0, тому конвертація робиться тут, а не через @Type.
const toPageNumber = ({ value }) =>
  value === undefined || value === '' ? undefined : Number(value);

export class FilterProductDto {
  @IsOptional()
  @IsEnum(Gender, { message: 'Неправильне значення статі' })
  gender?: Gender;

  @IsOptional()
  @IsEnumEach(Category, { message: 'Неправильна категорія' })
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
  @IsEnumEach(Season, { message: 'Неправильний сезон' })
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
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'Фільтр знижок має бути true або false' })
  onSale?: boolean;

  @IsOptional()
  @IsString({ message: 'Пошуковий запит має бути рядком' })
  search?: string;

  @IsOptional()
  @IsString({ message: 'Сортування має бути рядком' })
  sort?: string;

  @IsOptional()
  @Transform(toPageNumber)
  @IsInt({ message: 'Номер сторінки має бути цілим числом' })
  @Min(1, { message: 'Номер сторінки має бути не меншим за 1' })
  page?: number;

  @IsOptional()
  @Transform(toPageNumber)
  @IsInt({ message: 'Кількість товарів на сторінці має бути цілим числом' })
  @Min(1, { message: 'Кількість товарів на сторінці має бути не меншою за 1' })
  @Max(100, { message: 'Кількість товарів на сторінці має бути не більшою за 100' })
  limit?: number;
}
