import { IsInt, IsOptional, Min } from 'class-validator';

// Сума часткового повернення в копійках. Без DTO глобальний ValidationPipe
// не перевіряє тіло, і в mono пішли б рядок, від'ємне число чи дріб.
export class RefundPaymentDto {
  @IsOptional()
  @IsInt({ message: 'Сума має бути цілим числом у копійках' })
  @Min(1, { message: 'Сума має бути більшою за нуль' })
  amount?: number;
}
