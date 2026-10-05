import * as path from 'path';

// Каталог для завантажених файлів. Лежить поза `dist`, бо `prebuild` видаляє `dist` при кожній збірці.
// За замовчуванням `<корінь бекенду>/uploads`; відносний `UPLOADS_DIR` рахується від поточного каталогу.
export function getUploadsDir(): string {
  return process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.resolve(__dirname, '..', '..', 'uploads');
}
