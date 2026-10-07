import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const originalSecret = process.env.JWT_SECRET;

  const admin = {
    id: 1,
    phoneNumber: '380990000000',
    password: 'hash',
    roles: [{ value: 'USER' }, { value: 'ADMIN' }],
  };

  let usersService: { findById: jest.Mock };
  let strategy: JwtStrategy;

  beforeAll(() => {
    process.env.JWT_SECRET = 'jwt-strategy-spec-secret';
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  beforeEach(() => {
    usersService = { findById: jest.fn().mockResolvedValue(admin) };
    strategy = new JwtStrategy(usersService as any);
  });

  it('returns the user from the database without the password', async () => {
    await expect(strategy.validate({ sub: 1, phoneNumber: admin.phoneNumber })).resolves.toEqual({
      id: admin.id,
      phoneNumber: admin.phoneNumber,
      roles: admin.roles,
    });
    expect(usersService.findById).toHaveBeenCalledWith(1);
  });

  it('accepts an id sent as a numeric string', async () => {
    await expect(strategy.validate({ sub: '1', phoneNumber: admin.phoneNumber })).resolves.toEqual({
      id: admin.id,
      phoneNumber: admin.phoneNumber,
      roles: admin.roles,
    });
  });

  it('gives 401 when the user has been deleted', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 1, phoneNumber: admin.phoneNumber }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([
    ['there is no payload', undefined],
    ['there is no id', { phoneNumber: admin.phoneNumber }],
    ['the id is null', { sub: null, phoneNumber: admin.phoneNumber }],
    ['the id is not a number', { sub: 'abc', phoneNumber: admin.phoneNumber }],
    ['the id is a boolean', { sub: true, phoneNumber: admin.phoneNumber }],
    ['the id is zero', { sub: 0, phoneNumber: admin.phoneNumber }],
    ['the id is negative', { sub: -1, phoneNumber: admin.phoneNumber }],
    ['the id is not an integer', { sub: 1.5, phoneNumber: admin.phoneNumber }],
  ])('gives 401 when %s', async (_, payload) => {
    await expect(strategy.validate(payload as any)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usersService.findById).not.toHaveBeenCalled();
  });
});
