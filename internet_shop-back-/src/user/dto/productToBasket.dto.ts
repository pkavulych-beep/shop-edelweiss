import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class productToBasketDto {
  @IsNotEmpty({ message: 'Не вказано товар' })
  idProduct: number;

  @IsOptional()
  @IsString({ message: 'Розмір має бути рядком' })
  @IsNotEmpty({ message: 'Розмір не може бути порожнім' })
  size?: string;
}
