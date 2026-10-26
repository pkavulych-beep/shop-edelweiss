import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as uuid from 'uuid';
import { getUploadsDir } from './uploads-dir';
import { validateImageFile } from './image';

export enum FileType {
  IMAGE = 'image',
}

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  // Повертає відносний шлях (`image/<uuid>.png`): домен і порт API можуть
  // змінитися, тому повний URL збираємо з поточного BASE_URL під час відповіді.
  createFile(type: FileType, file): string {
    try {
      const fileExtension = validateImageFile(file);
      const fileName = uuid.v4() + '.' + fileExtension;
      const filePath = path.resolve(getUploadsDir(), type);
      if (!fs.existsSync(filePath)) {
        fs.mkdirSync(filePath, { recursive: true });
      }
      fs.writeFileSync(path.resolve(filePath, fileName), file.buffer);
      return type + '/' + fileName;
    } catch (e) {
      if (e instanceof HttpException) {
        throw e;
      }
      this.logger.error('Failed to create file', e);
      throw new HttpException('Не вдалося створити файл', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async deleteFile(filePath: string) {
    try {
      const absolutePath = this.resolveFilePath(filePath);

      // Перевіряємо, чи існує файл
      if (!fs.existsSync(absolutePath)) {
        this.logger.warn(`File not found: ${filePath}`);
        throw new HttpException('Файл не знайдено', HttpStatus.NOT_FOUND);
      }

      // Видаляємо файл
      fs.unlinkSync(absolutePath);
    } catch (e) {
      if (e instanceof HttpException) {
        throw e;
      }
      this.logger.error('Failed to delete file', e);
      throw new HttpException('Не вдалося видалити файл', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Шлях із бази відносний, але приймаємо й старий повний URL, щоб видалення
  // не зламалося на даних, які ще не пройшли міграцію.
  private resolveFilePath(filePath: string): string {
    const relativePath = (filePath || '').replace(/^https?:\/\/[^/]+\//i, '');
    const uploadsDir = getUploadsDir();
    const absolutePath = path.resolve(uploadsDir, relativePath);

    if (
      !relativePath ||
      absolutePath === uploadsDir ||
      !absolutePath.startsWith(uploadsDir + path.sep)
    ) {
      throw new BadRequestException('Некоректний шлях до файлу');
    }

    return absolutePath;
  }
}
