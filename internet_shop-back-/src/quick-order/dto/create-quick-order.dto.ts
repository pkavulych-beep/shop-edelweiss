import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, Validate } from 'class-validator';
import { IsValidPhoneConstraint } from '../../common/phone-validator';
import { MAX_INT } from '../../common/constants';

export class CreateQuickOrderDto {
  @Validate(IsValidPhoneConstraint)
  phoneNumber: string;

  @IsInt({ message: 'Ідентифікатор товару має бути цілим числом' })
  @Min(1, { message: 'Ідентифікатор товару має бути більшим за 0' })
  @Max(MAX_INT, { message: 'Ідентифікатор товару занадто великий' })
  productId: number;

  @IsOptional()
  @IsString({ message: 'Розмір має бути рядком' })
  @IsNotEmpty({ message: 'Розмір не може бути порожнім' })
  size?: string;
}
