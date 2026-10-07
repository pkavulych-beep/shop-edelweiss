import {
  ConflictException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';
import { hashPassword, isPasswordHash } from './password';

describe('AuthService.validateUser', () => {
  let usersService;
  let service: AuthService;

  beforeEach(() => {
    usersService = {
      findByPhoneWithPassword: jest.fn(),
      setPasswordHash: jest.fn(),
    };
    service = new AuthService(usersService, {} as any, {} as any);
  });

  it('looks the user up by phone only and compares the hash', async () => {
    usersService.findByPhoneWithPassword.mockResolvedValue({
      id: 1,
      phoneNumber: '380991112233',
      password: await hashPassword('secret123'),
    });

    const user = await service.validateUser('380991112233', 'secret123');

    expect(usersService.findByPhoneWithPassword).toHaveBeenCalledWith(
      '380991112233',
    );
    expect(user).toEqual({ id: 1, phoneNumber: '380991112233' });
    expect(usersService.setPasswordHash).not.toHaveBeenCalled();
  });

  it('normalizes the phone number before the lookup', async () => {
    usersService.findByPhoneWithPassword.mockResolvedValue({
      id: 1,
      phoneNumber: '380991112233',
      password: await hashPassword('secret123'),
    });

    const user = await service.validateUser('+38 (099) 111-22-33', 'secret123');

    expect(usersService.findByPhoneWithPassword).toHaveBeenCalledWith(
      '380991112233',
    );
    expect(user).toEqual({ id: 1, phoneNumber: '380991112233' });
  });

  it('does not look up a phone that cannot be Ukrainian', async () => {
    await expect(service.validateUser('12', 'secret123')).resolves.toBeNull();

    expect(usersService.findByPhoneWithPassword).not.toHaveBeenCalled();
  });

  it('rejects a wrong password', async () => {
    usersService.findByPhoneWithPassword.mockResolvedValue({
      id: 1,
      password: await hashPassword('secret123'),
    });

    await expect(service.validateUser('380991112233', 'wrong-pass')).resolves.toBeNull();
  });

  it('rejects an unknown phone number', async () => {
    usersService.findByPhoneWithPassword.mockResolvedValue(null);

    await expect(service.validateUser('380991112233', 'secret123')).resolves.toBeNull();
  });

  it('replaces a legacy plain-text password with a hash on login', async () => {
    usersService.findByPhoneWithPassword.mockResolvedValue({
      id: 7,
      password: 'oldpass',
    });

    const user = await service.validateUser('380991112233', 'oldpass');

    expect(user).toEqual({ id: 7 });
    const [id, hash] = usersService.setPasswordHash.mock.calls[0];
    expect(id).toBe(7);
    expect(isPasswordHash(hash)).toBe(true);
  });

  it('does not touch a legacy password when it does not match', async () => {
    usersService.findByPhoneWithPassword.mockResolvedValue({
      id: 7,
      password: 'oldpass',
    });

    await expect(service.validateUser('380991112233', 'wrong-pass')).resolves.toBeNull();
    expect(usersService.setPasswordHash).not.toHaveBeenCalled();
  });
});

describe('AuthService.register', () => {
  let usersService;
  let jwtService;
  let refreshTokens;
  let service: AuthService;
  const dto = {
    fullName: 'Петро Петренко',
    email: 'petro@example.com',
    phoneNumber: '380991112233',
    password: 'secret123',
  };

  beforeEach(() => {
    usersService = { create: jest.fn() };
    jwtService = { sign: jest.fn().mockReturnValue('jwt-token') };
    refreshTokens = { delete: jest.fn(), insert: jest.fn() };
    service = new AuthService(usersService, jwtService, refreshTokens);
  });

  it('passes a conflict about a taken phone/email through unchanged', async () => {
    const conflict = new ConflictException(
      'Користувач з таким номером телефону вже існує',
    );
    usersService.create.mockRejectedValue(conflict);

    const error = await service.register(dto as any).catch((e) => e);

    expect(error).toBe(conflict);
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(409);
    expect(error.message).toBe(
      'Користувач з таким номером телефону вже існує',
    );
    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('keeps the separate message for a taken email', async () => {
    usersService.create.mockRejectedValue(
      new ConflictException(
        'Користувач з такою електронною поштою вже існує',
      ),
    );

    const error = await service.register(dto as any).catch((e) => e);

    expect(error.getStatus()).toBe(409);
    expect(error.message).toBe(
      'Користувач з такою електронною поштою вже існує',
    );
  });

  it('turns an unexpected error into a 500', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    usersService.create.mockRejectedValue(new Error('db is down'));

    const error = await service.register(dto as any).catch((e) => e);

    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect(error.getStatus()).toBe(500);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('returns user data and tokens on success', async () => {
    usersService.create.mockResolvedValue({
      id: 3,
      phoneNumber: dto.phoneNumber,
      password: 'hashed',
    });

    await expect(service.register(dto as any)).resolves.toEqual({
      userData: { id: 3, phoneNumber: dto.phoneNumber },
      token: 'jwt-token',
      refreshToken: expect.any(String),
    });
    expect(refreshTokens.insert).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 3 }),
    );
    expect(jwtService.sign).toHaveBeenCalledWith({
      phoneNumber: dto.phoneNumber,
      sub: 3,
      roles: undefined,
    });
  });
});

describe('AuthService refresh tokens', () => {
  const sha256 = (value: string) =>
    createHash('sha256').update(value).digest('hex');
  const user = { id: 5, phoneNumber: '380991112233', roles: [] };

  let usersService;
  let jwtService;
  let rows: any[];
  let refreshTokens;
  let service: AuthService;

  // Мінімальна таблиця refresh_tokens у пам'яті: підтримує лише ті умови,
  // які використовує AuthService
  const matches = (row, where) =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === 'object' && '_type' in (value as any)) {
        return (value as any)._type === 'isNull'
          ? row[key] === null
          : row[key] < (value as any)._value;
      }
      return row[key] === value;
    });

  beforeEach(() => {
    rows = [];
    usersService = { findById: jest.fn().mockResolvedValue(user) };
    let nextToken = 0;
    jwtService = { sign: jest.fn(() => `access-${++nextToken}`) };
    refreshTokens = {
      insert: jest.fn(async (data) => {
        rows.push({ id: rows.length + 1, revokedAt: null, ...data });
      }),
      delete: jest.fn(async (where) => {
        rows = rows.filter((row) => !matches(row, where));
      }),
      findOne: jest.fn(
        async ({ where }) => rows.find((row) => matches(row, where)) ?? null,
      ),
      update: jest.fn(async (where, data) => {
        const found = rows.filter((row) => matches(row, where));
        found.forEach((row) => Object.assign(row, data));
        return { affected: found.length };
      }),
    };
    service = new AuthService(usersService, jwtService, refreshTokens);
  });

  it('issues a short access token and stores only a hash of the refresh token', async () => {
    const { token, refreshToken } = await service.issueTokens(user as any);

    expect(token).toBe('access-1');
    expect(jwtService.sign).toHaveBeenCalledWith({
      phoneNumber: user.phoneNumber,
      sub: user.id,
      roles: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(sha256(refreshToken));
    expect(JSON.stringify(rows)).not.toContain(refreshToken);

    const ttl = rows[0].expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000);
  });

  it('rotates the refresh token: the new one works, the old one does not', async () => {
    const first = await service.issueTokens(user as any);

    const second = await service.refresh(first.refreshToken);

    expect(second.token).toBe('access-2');
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(usersService.findById).toHaveBeenCalledWith(user.id);
    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.refresh(second.refreshToken)).resolves.toEqual(
      expect.objectContaining({ token: 'access-3' }),
    );
  });

  it('rejects the refresh token after logout', async () => {
    const { refreshToken } = await service.issueTokens(user as any);

    await service.logout(refreshToken);

    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logout revokes only that session', async () => {
    const phone = await service.issueTokens(user as any);
    const laptop = await service.issueTokens(user as any);

    await service.logout(phone.refreshToken);

    await expect(service.refresh(laptop.refreshToken)).resolves.toBeDefined();
  });

  it('rejects an expired refresh token', async () => {
    const { refreshToken } = await service.issueTokens(user as any);
    rows[0].expiresAt = new Date(Date.now() - 1000);

    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an unknown refresh token', async () => {
    await expect(service.refresh('made-up')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('gives a new token to only one of two concurrent refreshes', async () => {
    const { refreshToken } = await service.issueTokens(user as any);

    const results = await Promise.allSettled([
      service.refresh(refreshToken),
      service.refresh(refreshToken),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('rejects the refresh token of a deleted user', async () => {
    const { refreshToken } = await service.issueTokens(user as any);
    usersService.findById.mockResolvedValue(null);

    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('removes expired refresh tokens of the user when issuing a new one', async () => {
    await service.issueTokens(user as any);
    rows[0].expiresAt = new Date(Date.now() - 1000);

    await service.issueTokens(user as any);

    expect(rows).toHaveLength(1);
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
