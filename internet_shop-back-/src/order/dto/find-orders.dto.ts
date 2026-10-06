import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Status, statusMessage } from '../statusEnum';

// Параметри списку замовлень в адмінці: пагінація й фільтр за статусом
export class FindOrdersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Номер сторінки має бути цілим числом' })
  @Min(1, { message: 'Номер сторінки має бути не менше 1' })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Кількість замовлень на сторінці має бути цілим числом' })
  @Min(1, { message: 'Кількість замовлень на сторінці має бути не менше 1' })
  @Max(100, {
    message: 'Кількість замовлень на сторінці має бути не більше 100',
  })
  limit = 20;

  @IsOptional()
  @IsEnum(Status, { message: statusMessage })
  status?: Status;
}
