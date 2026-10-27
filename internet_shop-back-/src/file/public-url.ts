// Публічна адреса API зі слешем на кінці: BASE_URL або локальний порт за замовчуванням.
// Читаємо env щоразу, а не один раз під час імпорту, щоб зміна BASE_URL (інший домен,
// порт чи HTTPS) одразу застосовувалась до вже збережених фото.
export function getBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const baseUrl = env.BASE_URL || 'http://localhost:7777/';
  return baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
}

// У базі фото лежать відносними шляхами (`image/<uuid>.png`). Повний URL збираємо
// під час серіалізації, тому поля `cover` і `url` у JSON лишаються тими самими.
export function toPublicFileUrl(
  filePath: string | null | undefined,
): string | null | undefined {
  if (!filePath) return filePath;
  if (/^https?:\/\//i.test(filePath)) return filePath;
  return getBaseUrl() + filePath.replace(/^\/+/, '');
}
