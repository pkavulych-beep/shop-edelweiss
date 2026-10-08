import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Validate } from 'class-validator';
import { IsValidPhoneConstraint } from '../../common/phone-validator';

export class CreateQuickOrderDto {
  @Validate(IsValidPhoneConstraint, { message: 'Вкажіть український номер телефону у форматі +38 (0XX) XXX-XX-XX' })
  phoneNumber: string;

  @IsInt({ message: 'Ідентифікатор товару має бути цілим числом' })
  @Max(2147483647, { message: 'Ідентифікатор товару занадто великий' })
  productId: number;

  @IsOptional()
  @IsString({ message: 'Розмір має бути рядком' })
  @IsNotEmpty({ message: 'Розмір не може бути порожнім' })
  size?: string;
}
