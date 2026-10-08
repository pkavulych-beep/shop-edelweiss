import { IsArray, IsInt, Max, Min } from 'class-validator';
import { MAX_INT } from '../../common/constants';

export class FindByIdsDto {
  @IsArray({ message: 'Ідентифікатори товарів мають бути списком' })
  @IsInt({ each: true, message: 'Кожен ідентифікатор товару має бути цілим числом' })
  @Min(1, { each: true, message: 'Ідентифікатор товару має бути більшим за 0' })
  @Max(MAX_INT, { each: true, message: 'Ідентифікатор товару занадто великий' })
  ids: number[];
}
