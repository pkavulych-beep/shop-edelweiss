import { IsArray, IsNumber } from 'class-validator';

export class FindByIdsDto {
  @IsArray({ message: 'Ідентифікатори товарів мають бути списком' })
  @IsNumber({}, { each: true, message: 'Кожен ідентифікатор товару має бути числом' })
  ids: number[];
}
