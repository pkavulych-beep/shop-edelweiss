import { Logger } from '@nestjs/common';

// Значення з .env.example: якщо воно потрапило в production, секрет фактично публічний.
export const PLACEHOLDER_JWT_SECRET = 'change-me';
export const MIN_JWT_SECRET_LENGTH = 32;

export interface EnvLogger {
  error(message: string): void;
  warn(message: string): void;
}

const defaultLogger = new Logger('Security');

// У production без власного секрету застосунок не має стартувати: інакше токени
// підписуються відомим усім значенням. Короткий секрет лише попередження, бо CI
// smoke-тест стартує з коротким.
export function resolveJwtSecret(
  env: NodeJS.ProcessEnv = process.env,
  logger: EnvLogger = defaultLogger,
): string | undefined {
  const secret = env.JWT_SECRET?.trim() || undefined;

  if (env.NODE_ENV !== 'production') {
    return secret;
  }

  if (!secret || secret === PLACEHOLDER_JWT_SECRET) {
    const message =
      'JWT_SECRET is not set or is still the "change-me" placeholder. Set a long random value before starting in production.';
    logger.error(message);
    throw new Error(message);
  }

  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    logger.warn(
      `JWT_SECRET is shorter than ${MIN_JWT_SECRET_LENGTH} characters. Use a longer random value, e.g. from "openssl rand -hex 32".`,
    );
  }

  return secret;
}

// Браузер надсилає Origin без завершального слеша, а FRONTEND_URL у .env.example
// записаний зі слешем для redirect після оплати. Кілька адрес — через кому.
export function parseFrontendOrigins(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const origins = value
    .split(',')
    .map(origin => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return [...new Set(origins)];
}

const LOCALHOST_ANY_PORT = /^http:\/\/localhost:\d+$/;

// Без FRONTEND_URL локально дозволяємо будь-який порт localhost (агенти працюють
// на різних портах), а в production — жодного стороннього origin.
export function resolveCorsOrigin(env: NodeJS.ProcessEnv = process.env): string[] | RegExp {
  const origins = parseFrontendOrigins(env.FRONTEND_URL);
  if (origins.length > 0) {
    return origins;
  }

  if (env.NODE_ENV !== 'production') {
    return LOCALHOST_ANY_PORT;
  }

  return [];
}

export type TrustProxy = boolean | number | string;

// Express приймає число переходів, true/false або підмережу/ім'я типу "loopback".
export function resolveTrustProxy(env: NodeJS.ProcessEnv = process.env): TrustProxy | undefined {
  const value = env.TRUST_PROXY?.trim();
  if (!value) {
    return undefined;
  }

  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  return value;
}
