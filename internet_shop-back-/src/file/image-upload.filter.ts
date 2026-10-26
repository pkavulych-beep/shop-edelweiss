import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { IMAGE_SIZE_ERROR } from './image';

// Multer перетворює перевищення limits.fileSize на 413 «File too large».
// Для фото товару відповідаємо 400 із зрозумілим українським повідомленням.
@Catch(PayloadTooLargeException)
export class ImageTooLargeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: IMAGE_SIZE_ERROR,
      error: 'Bad Request',
    });
  }
}
