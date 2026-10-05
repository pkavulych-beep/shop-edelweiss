import { IsNotEmpty } from 'class-validator';

export class CreateRoleDto {
  @IsNotEmpty({ message: 'Вкажіть назву ролі' })
  readonly value: string;

  @IsNotEmpty({ message: 'Вкажіть опис ролі' })
  readonly description: string;
}
