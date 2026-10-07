import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, Length, Matches } from 'class-validator';
import {
  normalizePhone,
  UA_PHONE_MESSAGE,
  UA_PHONE_PATTERN,
} from '../../common/phone';

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

  @Transform(({ value }) => normalizePhone(value))
  @Matches(UA_PHONE_PATTERN, { message: UA_PHONE_MESSAGE })
  phoneNumber: string;

  @IsOptional()
  basketId?: number;
}
