import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function isPasswordHash(value: string): boolean {
  return BCRYPT_HASH.test(value);
}

// Акаунти, створені до хешування, ще зберігають пароль відкритим текстом.
// Такий пароль порівнюємо напряму, а AuthService після успішного входу замінює його хешем.
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (!stored) return false;
  if (isPasswordHash(stored)) return bcrypt.compare(password, stored);
  return password === stored;
}
