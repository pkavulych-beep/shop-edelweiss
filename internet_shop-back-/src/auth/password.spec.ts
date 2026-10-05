import { hashPassword, isPasswordHash, verifyPassword } from './password';

describe('password', () => {
  it('stores a bcrypt hash instead of the password', async () => {
    const hash = await hashPassword('secret123');

    expect(hash).not.toContain('secret123');
    expect(isPasswordHash(hash)).toBe(true);
  });

  it('verifies a password against its hash', async () => {
    const hash = await hashPassword('secret123');

    await expect(verifyPassword('secret123', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-pass', hash)).resolves.toBe(false);
  });

  it('verifies a legacy plain-text password', async () => {
    expect(isPasswordHash('secret123')).toBe(false);
    await expect(verifyPassword('secret123', 'secret123')).resolves.toBe(true);
    await expect(verifyPassword('wrong-pass', 'secret123')).resolves.toBe(false);
  });

  it('rejects a user without a stored password', async () => {
    await expect(verifyPassword('secret123', undefined)).resolves.toBe(false);
  });
});
