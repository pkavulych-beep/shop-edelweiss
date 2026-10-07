import {
  ConflictException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
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
    service = new AuthService(usersService, {} as any);
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
    service = new AuthService(usersService, jwtService);
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

  it('returns user data and a token on success', async () => {
    usersService.create.mockResolvedValue({
      id: 3,
      phoneNumber: dto.phoneNumber,
      password: 'hashed',
    });

    await expect(service.register(dto as any)).resolves.toEqual({
      userData: { id: 3, phoneNumber: dto.phoneNumber },
      token: 'jwt-token',
    });
    expect(jwtService.sign).toHaveBeenCalledWith({
      phoneNumber: dto.phoneNumber,
      sub: 3,
      roles: undefined,
    });
  });
});
