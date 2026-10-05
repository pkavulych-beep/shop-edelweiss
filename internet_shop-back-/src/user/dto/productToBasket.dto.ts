import { IsNotEmpty, IsString } from 'class-validator';

export class productToBasketDto {
  @IsNotEmpty({ message: 'Не вказано користувача' })
  idUser: number;

  @IsNotEmpty({ message: 'Не вказано товар' })
  idProduct: number;

  @IsNotEmpty({ message: 'Оберіть розмір' })
  @IsString({ message: 'Розмір має бути рядком' })
  size: string;
}
