import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class OrderItemDto {
  @IsInt({ message: 'Ідентифікатор товару має бути цілим числом' })
  productId: number;

  @IsString({ message: 'Розмір має бути рядком' })
  @IsNotEmpty({ message: 'Вкажіть розмір товару' })
  size: string;

  @IsInt({ message: 'Кількість має бути цілим числом' })
  @Min(1, { message: 'Кількість має бути не менше 1' })
  @Max(100, { message: 'Кількість має бути не більше 100' })
  quantity: number;
}
