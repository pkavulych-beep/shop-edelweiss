import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MAX_INT } from '../../common/constants';

export class ChangeBasketQuantityDto {
  @IsInt({ message: 'Ідентифікатор товару має бути цілим числом' })
  @Min(1, { message: 'Ідентифікатор товару має бути більшим за 0' })
  @Max(MAX_INT, { message: 'Ідентифікатор товару занадто великий' })
  idProduct: number;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString({ message: 'Розмір має бути рядком' })
  size?: string;

  @IsInt({ message: 'Кількість має бути цілим числом' })
  @Min(1, { message: 'Кількість має бути не меншою за 1' })
  @Max(100, { message: 'Кількість має бути не більшою за 100' })
  quantity: number;
}
