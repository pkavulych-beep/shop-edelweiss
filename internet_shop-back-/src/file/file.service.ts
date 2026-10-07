import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as uuid from 'uuid';
import { getUploadsDir } from './uploads-dir';

export enum FileType {
  IMAGE = 'image',
}

export const baseUrl = process.env.BASE_URL || 'http://localhost:7777/';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  createFile(type: FileType, file): string {
    try {
      const fileExtension = file.originalname.split('.').pop();
      const fileName = uuid.v4() + '.' + fileExtension;
      const filePath = path.resolve(getUploadsDir(), type);
      if (!fs.existsSync(filePath)) {
        fs.mkdirSync(filePath, { recursive: true });
      }
      fs.writeFileSync(path.resolve(filePath, fileName), file.buffer);
      return baseUrl + type + '/' + fileName;
    } catch (e) {
      this.logger.error('Failed to create file', e);
      throw new HttpException('Не вдалося створити файл', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async deleteFile(fileUrl: string) {
    try {
      // Видаляємо baseUrl, якщо він присутній
      const filePath = fileUrl.replace(baseUrl, '');

      // Отримуємо абсолютний шлях до файлу
      const absolutePath = path.resolve(getUploadsDir(), filePath);

      // Перевіряємо, чи існує файл
      if (!fs.existsSync(absolutePath)) {
        this.logger.warn(`File not found: ${filePath}`);
        throw new HttpException('Файл не знайдено', HttpStatus.NOT_FOUND);
      }

      // Видаляємо файл
      fs.unlinkSync(absolutePath);
      this.logger.log(`${filePath} was deleted`);
    } catch (e) {
      if (e instanceof HttpException) {
        throw e;
      }
      this.logger.error('Failed to delete file', e);
      throw new HttpException('Не вдалося видалити файл', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
