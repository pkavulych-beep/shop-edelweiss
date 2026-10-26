import { BadRequestException } from '@nestjs/common';

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export const IMAGE_FORMAT_ERROR = 'Фото має бути у форматі JPG, PNG або WEBP';
export const IMAGE_SIZE_ERROR = 'Фото завелике: до 10 МБ';

const EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const IMAGE_MIME_TYPES = Object.keys(EXTENSION_BY_MIME);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

interface UploadedImage {
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
}

// Розширення беремо з типу вмісту, а не з імені файлу: .html, перейменований на .png,
// не пройде перевірку сигнатури.
function detectExtension(buffer: Buffer): string | null {
  if (
    buffer.length >= PNG_SIGNATURE.length &&
    buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    return 'png';
  }
  if (
    buffer.length >= JPEG_SIGNATURE.length &&
    buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)
  ) {
    return 'jpg';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export function validateImageFile(file: UploadedImage): string {
  if (!file?.mimetype || !IMAGE_MIME_TYPES.includes(file.mimetype)) {
    throw new BadRequestException(IMAGE_FORMAT_ERROR);
  }

  const size = file.size ?? file.buffer?.length ?? 0;
  if (size > MAX_IMAGE_SIZE_BYTES) {
    throw new BadRequestException(IMAGE_SIZE_ERROR);
  }

  const extension = file.buffer ? detectExtension(file.buffer) : null;
  if (!extension || EXTENSION_BY_MIME[file.mimetype] !== extension) {
    throw new BadRequestException(IMAGE_FORMAT_ERROR);
  }

  return extension;
}
