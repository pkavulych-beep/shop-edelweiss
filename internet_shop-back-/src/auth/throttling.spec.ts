import {
  ThrottlerException,
  ThrottlerGuard,
  ThrottlerStorageService,
  seconds,
} from '@nestjs/throttler';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AUTH_ATTEMPTS_LIMIT, AUTH_ATTEMPTS_TTL, TOO_MANY_ATTEMPTS_MESSAGE } from './throttling';

const THROTTLER_LIMIT = 'THROTTLER:LIMITdefault';
const THROTTLER_TTL = 'THROTTLER:TTLdefault';

const moduleOptions = {
  throttlers: [{ limit: AUTH_ATTEMPTS_LIMIT, ttl: AUTH_ATTEMPTS_TTL }],
  errorMessage: TOO_MANY_ATTEMPTS_MESSAGE,
};

describe('ліміт спроб входу і реєстрації', () => {
  let storage: ThrottlerStorageService;
  let guard: ThrottlerGuard;

  const contextFor = (handler: any, ip = '203.0.113.7') => {
    const headers: Record<string, string> = {};
    const res = {
      header: jest.fn((name: string, value: string | number) => {
        headers[name] = String(value);
      }),
    };
    return {
      headers,
      res,
      context: {
        getHandler: () => handler,
        getClass: () => AuthController,
        switchToHttp: () => ({
          getRequest: () => ({ ip, headers: {} }),
          getResponse: () => res,
          getNext: () => undefined,
        }),
      } as any,
    };
  };

  beforeEach(async () => {
    storage = new ThrottlerStorageService();
    guard = new ThrottlerGuard(moduleOptions as any, storage, new Reflector());
    await guard.onModuleInit();
  });

  afterEach(async () => {
    await storage.onApplicationShutdown();
    jest.useRealTimers();
  });

  it('пропускає 5 спроб за хвилину, а шосту відхиляє з 429', async () => {
    const login = contextFor(AuthController.prototype.login);

    for (let attempt = 1; attempt <= AUTH_ATTEMPTS_LIMIT; attempt++) {
      await expect(guard.canActivate(login.context)).resolves.toBe(true);
    }

    const error = await guard.canActivate(login.context).catch(e => e);

    expect(error).toBeInstanceOf(ThrottlerException);
    expect(error.getStatus()).toBe(429);
    expect(error.message).toBe(TOO_MANY_ATTEMPTS_MESSAGE);
    expect(login.headers['Retry-After']).toBeDefined();
  });

  it('рахує логін і реєстрацію окремо', async () => {
    const login = contextFor(AuthController.prototype.login);
    const register = contextFor(AuthController.prototype.register);

    for (let attempt = 1; attempt <= AUTH_ATTEMPTS_LIMIT; attempt++) {
      await guard.canActivate(login.context);
    }
    await expect(guard.canActivate(login.context)).rejects.toBeInstanceOf(ThrottlerException);

    await expect(guard.canActivate(register.context)).resolves.toBe(true);
  });

  it('через хвилину дозволяє спроби знову', async () => {
    jest.useFakeTimers();
    const start = Date.now();
    const login = contextFor(AuthController.prototype.login);

    for (let attempt = 1; attempt <= AUTH_ATTEMPTS_LIMIT; attempt++) {
      await guard.canActivate(login.context);
    }
    await expect(guard.canActivate(login.context)).rejects.toBeInstanceOf(ThrottlerException);

    jest.setSystemTime(start + AUTH_ATTEMPTS_TTL + 1000);

    await expect(guard.canActivate(login.context)).resolves.toBe(true);
  });

  it('ліміт різний для різних IP', async () => {
    const first = contextFor(AuthController.prototype.login, '203.0.113.7');
    const second = contextFor(AuthController.prototype.login, '203.0.113.8');

    for (let attempt = 1; attempt <= AUTH_ATTEMPTS_LIMIT; attempt++) {
      await guard.canActivate(first.context);
    }
    await expect(guard.canActivate(first.context)).rejects.toBeInstanceOf(ThrottlerException);

    await expect(guard.canActivate(second.context)).resolves.toBe(true);
  });
});

describe('налаштування ліміту на маршрутах', () => {
  it('обмежує login і register 5 спробами на хвилину', () => {
    const handlers = [AuthController.prototype.login, AuthController.prototype.register];

    handlers.forEach(handler => {
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(ThrottlerGuard);
      expect(Reflect.getMetadata(THROTTLER_LIMIT, handler)).toBe(AUTH_ATTEMPTS_LIMIT);
      expect(Reflect.getMetadata(THROTTLER_TTL, handler)).toBe(seconds(60));
    });
  });

  it('перевіряє ліміт раніше за перевірку пароля', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype.login);

    expect(guards).toEqual([ThrottlerGuard, LocalAuthGuard]);
  });

  it('не обмежує перевірку профілю', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype.getProfile)).not.toContain(
      ThrottlerGuard,
    );
  });
});
