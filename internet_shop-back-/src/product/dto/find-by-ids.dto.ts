import { IsArray, IsNumber, Max } from 'class-validator';
import { MAX_INT } from '../../common/constants';

export class FindByIdsDto {
  @IsArray({ message: 'Ідентифікатори товарів мають бути списком' })
  @IsNumber({}, { each: true, message: 'Кожен ідентифікатор товару має бути числом' })
  @Max(MAX_INT, { each: true, message: 'Ідентифікатор товару занадто великий' })
  ids: number[];
}
