import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, Length } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty({ message: "Вкажіть прізвище, ім'я та по батькові" })
  fullName: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsEmail({}, { message: 'Некоректна адреса електронної пошти' })
  email?: string;

  @Length(6, 32, { message: 'Пароль повинен містити від 6 до 32 символів' })
  password: string;

  @IsNotEmpty({ message: 'Вкажіть номер телефону' })
  phoneNumber: string;

  @IsOptional()
  basketId?: number;
}
