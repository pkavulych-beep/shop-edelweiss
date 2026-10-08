import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MAX_INT } from '../../common/constants';

export class productToBasketDto {
  @IsInt({ message: 'Ідентифікатор товару має бути цілим числом' })
  @Min(1, { message: 'Ідентифікатор товару має бути більшим за 0' })
  @Max(MAX_INT, { message: 'Ідентифікатор товару занадто великий' })
  idProduct: number;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString({ message: 'Розмір має бути рядком' })
  size?: string;
}
