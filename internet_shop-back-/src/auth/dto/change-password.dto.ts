import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty({ message: 'Вкажіть поточний пароль' })
  @IsString({ message: 'Поточний пароль має бути рядком' })
  currentPassword: string;

  @IsString({ message: 'Пароль повинен бути рядком' })
  @Length(6, 32, { message: 'Пароль повинен містити від 6 до 32 символів' })
  newPassword: string;
}
