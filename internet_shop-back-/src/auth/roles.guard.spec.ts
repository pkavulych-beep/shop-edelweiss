import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Roles } from './roles-auth.decorator';
import { RolesGuard } from './roles.guard';
import { JwtStrategy } from './strategy/jwt.strategy';

const SECRET = 'test-secret';

class AdminController {
  @Roles('ADMIN')
  adminOnly() {}

  open() {}
}

describe('RolesGuard', () => {
  let usersService: { findById: jest.Mock };
  let guard: RolesGuard;
  let token: string;
  const originalSecret = process.env.JWT_SECRET;

  const admin = {
    id: 1,
    phoneNumber: '380990000000',
    password: 'hash',
    roles: [{ value: 'USER' }, { value: 'ADMIN' }],
  };

  const contextFor = (handler: () => void, headers = {}) => {
    const req: any = { headers };
    return {
      req,
      context: {
        getHandler: () => handler,
        getClass: () => AdminController,
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => ({}),
          getNext: () => undefined,
        }),
      } as any,
    };
  };

  const adminRequest = (headers = { authorization: `Bearer ${token}` }) =>
    contextFor(AdminController.prototype.adminOnly, headers);

  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  beforeEach(() => {
    usersService = { findById: jest.fn().mockResolvedValue(admin) };
    // Реєструє стратегію 'jwt' у passport, як це робить AuthModule
    new JwtStrategy(usersService as any);
    guard = new RolesGuard(new Reflector());
    // У токені ролі ADMIN, як у токенах, виданих до цієї зміни
    token = new JwtService({ secret: SECRET }).sign({
      sub: admin.id,
      phoneNumber: admin.phoneNumber,
      roles: admin.roles,
    });
  });

  it('lets an admin in and puts the user from the database into req.user', async () => {
    const { req, context } = adminRequest();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(usersService.findById).toHaveBeenCalledWith(admin.id);
    expect(req.user).toEqual({
      id: admin.id,
      phoneNumber: admin.phoneNumber,
      roles: admin.roles,
    });
  });

  it('gives 403 to the same token right after ADMIN is taken away in the database', async () => {
    await expect(guard.canActivate(adminRequest().context)).resolves.toBe(true);

    usersService.findById.mockResolvedValue({
      ...admin,
      roles: [{ value: 'USER' }],
    });

    await expect(guard.canActivate(adminRequest().context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('gives 401 when the user has been deleted', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(guard.canActivate(adminRequest().context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('gives 401 without a token', async () => {
    await expect(guard.canActivate(adminRequest({} as any).context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('gives 401 for a token signed with another secret', async () => {
    const forged = new JwtService({ secret: 'other' }).sign({ sub: admin.id });

    await expect(
      guard.canActivate(adminRequest({ authorization: `Bearer ${forged}` }).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('does not check anything for a handler without @Roles', async () => {
    const { context } = contextFor(AdminController.prototype.open);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(usersService.findById).not.toHaveBeenCalled();
  });
});
