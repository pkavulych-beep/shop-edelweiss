import { IsEmail, IsNotEmpty, IsOptional, Length } from 'class-validator';

export class UpdateUserDto {
  @IsNotEmpty({ message: "Вкажіть прізвище, ім'я та по батькові" })
  fullName: string;

  @IsOptional()
  @IsEmail({}, { message: 'Некоректна адреса електронної пошти' })
  email: string;

  @IsOptional()
  @Length(6, 32, { message: 'Пароль повинен містити від 6 до 32 символів' })
  password: string;

  @IsNotEmpty({ message: 'Вкажіть номер телефону' })
  phoneNumber: string;
}
