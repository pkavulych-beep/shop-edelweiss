// Мініатюра лежить поруч з оригіналом: `image/<uuid>.thumb.webp`.
// Суфікс сталий, щоб шлях можна було відновити з оригіналу під час видалення.
export const THUMBNAIL_SUFFIX = '.thumb.webp';

export const THUMBNAIL_MAX_SIZE = 600;
export const THUMBNAIL_QUALITY = 80;

export function thumbnailPath(filePath: string): string {
  const slash = filePath.lastIndexOf('/');
  const dot = filePath.lastIndexOf('.');
  const base = dot > slash ? filePath.slice(0, dot) : filePath;
  return base + THUMBNAIL_SUFFIX;
}
