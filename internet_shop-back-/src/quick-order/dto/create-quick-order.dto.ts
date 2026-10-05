import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

// "+38 (099) 123-45-67", "099 123 45 67" і "380991234567" → "380991234567"
export const normalizePhone = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 && digits.startsWith('0') ? `38${digits}` : digits;
};

export class CreateQuickOrderDto {
  @Transform(({ value }) => normalizePhone(value))
  @IsString({ message: 'Телефон має бути рядком' })
  @Matches(/^380\d{9}$/, {
    message: 'Вкажіть український номер телефону у форматі +38 (0XX) XXX-XX-XX',
  })
  phoneNumber: string;

  @IsInt({ message: 'Ідентифікатор товару має бути цілим числом' })
  productId: number;

  @IsOptional()
  @IsString({ message: 'Розмір має бути рядком' })
  @IsNotEmpty({ message: 'Розмір не може бути порожнім' })
  size?: string;
}
