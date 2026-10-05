import { IsEmail, IsNotEmpty, IsOptional, Length } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty({ message: "Вкажіть прізвище, ім'я та по батькові" })
  fullName: string;

  @IsOptional()
  @IsEmail({}, { message: 'Некоректна адреса електронної пошти' })
  email?: string;

  @Length(4, undefined, { message: 'Пароль має містити щонайменше 4 символи' })
  password: string;

  @IsNotEmpty({ message: 'Вкажіть номер телефону' })
  phoneNumber: string;

  @IsOptional()
  basketId?: number;
}
