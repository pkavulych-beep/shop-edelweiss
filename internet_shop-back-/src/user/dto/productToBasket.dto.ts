import { IsNotEmpty, IsString } from 'class-validator';

export class productToBasketDto {
  @IsNotEmpty()
  idUser: number;

  @IsNotEmpty()
  idProduct: number;

  @IsNotEmpty()
  @IsString()
  size: string;
}
