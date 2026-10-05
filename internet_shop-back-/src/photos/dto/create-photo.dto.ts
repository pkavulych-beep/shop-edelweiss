import { IsNotEmpty } from 'class-validator';

export class CreatePhotoDto {
  @IsNotEmpty({ message: 'Вкажіть посилання на фото' })
  url: string;
}
