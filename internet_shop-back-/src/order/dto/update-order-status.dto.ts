import { IsEnum } from 'class-validator';
import { Status, statusMessage } from '../statusEnum';

export class UpdateOrderStatusDto {
  @IsEnum(Status, { message: statusMessage })
  status: Status;
}
