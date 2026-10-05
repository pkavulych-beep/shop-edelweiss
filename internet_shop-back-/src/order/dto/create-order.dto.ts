import {IsNotEmpty, IsOptional} from 'class-validator';
import {Column} from "typeorm";

export class CreateOrderDto {
  @IsNotEmpty({ message: 'Не вказано товари' })
  productId: number[];

  @IsOptional()
  comment: string;

  @IsOptional()
  cityName: string;

  @IsOptional()
  department: string;

  @Column()
  size: string;
}
