import {
  ArgumentMetadata,
  NotFoundException,
  ParseIntPipe,
  PipeTransform,
} from '@nestjs/common';
import { MAX_INT } from './constants';

// Числовий ':id' поза межами PostgreSQL integer (1 … 2147483647) не може
// існувати в базі, тому відповідаємо 404, а не 500 з QueryFailedError від
// TypeORM. Спільне рішення для /product, /order, /users, /photos, /quick-order:
// одне місце замість перевірки в кожному контролері.
export class ParseIdPipe implements PipeTransform<string> {
  private readonly parseIntPipe = new ParseIntPipe();

  constructor(private readonly message = 'Не знайдено') {}

  async transform(value: string, metadata: ArgumentMetadata): Promise<number> {
    const id = await this.parseIntPipe.transform(value, metadata);
    if (id > MAX_INT || id < 1) {
      throw new NotFoundException(null, this.message);
    }
    return id;
  }
}
