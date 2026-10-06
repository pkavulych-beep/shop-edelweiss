import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import {
  normalizePhone,
  UA_PHONE_MESSAGE,
  UA_PHONE_PATTERN,
} from '../../common/phone';

export class CreateQuickOrderDto {
  @Transform(({ value }) => normalizePhone(value))
  @IsString({ message: 'Телефон має бути рядком' })
  @Matches(UA_PHONE_PATTERN, { message: UA_PHONE_MESSAGE })
  phoneNumber: string;

  @IsInt({ message: 'Ідентифікатор товару має бути цілим числом' })
  productId: number;

  @IsOptional()
  @IsString({ message: 'Розмір має бути рядком' })
  @IsNotEmpty({ message: 'Розмір не може бути порожнім' })
  size?: string;
}
