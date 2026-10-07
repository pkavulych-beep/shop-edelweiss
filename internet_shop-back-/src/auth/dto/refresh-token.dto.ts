import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsNotEmpty({ message: 'Не передано refresh-токен' })
  @IsString({ message: 'Refresh-токен має бути рядком' })
  refreshToken: string;
}
