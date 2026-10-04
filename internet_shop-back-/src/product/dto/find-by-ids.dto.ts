import { IsArray, IsNumber } from 'class-validator';

export class FindByIdsDto {
  @IsArray()
  @IsNumber({}, { each: true })
  ids: number[];
}
