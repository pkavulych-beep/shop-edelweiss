import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { classToPlain } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserController } from './user.controller';
import { UserEntity } from './entities/user.entity';

describe('UserController', () => {
  let userService;
  let controller: UserController;

  const owner = { user: { id: 1, roles: [{ value: 'USER' }] } };
  const stranger = { user: { id: 2, roles: [{ value: 'USER' }] } };
  const admin = { user: { id: 3, roles: [{ value: 'ADMIN' }] } };

  beforeEach(() => {
    userService = {
      findOrders: jest.fn().mockResolvedValue([]),
      addProductToBasket: jest.fn(),
      pickUpFromTheBasket: jest.fn(),
      syncCart: jest.fn(),
      cleanTheBasket: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
    };
    controller = new UserController(userService);
  });

  it('is guarded by JwtAuthGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, UserController)).toContain(
      JwtAuthGuard,
    );
  });

  it('takes the basket owner from the token, not from the body', () => {
    const dto = { idUser: 99, idProduct: 5, size: 'M' } as any;

    controller.addProductToBasket(owner, dto);
    controller.pickUpFromTheBasket(owner, dto);
    controller.syncCart(owner, { idUser: 99, items: [] } as any);

    expect(userService.addProductToBasket).toHaveBeenCalledWith(1, dto);
    expect(userService.pickUpFromTheBasket).toHaveBeenCalledWith(1, dto);
    expect(userService.syncCart).toHaveBeenCalledWith(1, []);
  });

  const byId: [string, (req: any, id: number) => unknown][] = [
    ['findOrders', (req, id) => controller.findOrders(req, id)],
    ['cleanTheBasket', (req, id) => controller.cleanTheBasket(req, id)],
    ['update', (req, id) => controller.update(req, id, {} as any)],
    ['findOne', (req, id) => controller.findOne(req, id)],
  ];

  describe.each(byId)('%s', (handler, call) => {
    it('allows the owner', () => {
      call(owner, 1);
      expect(userService[handler === 'findOne' ? 'findById' : handler])
        .toHaveBeenCalled();
    });

    it('allows an admin', () => {
      expect(() => call(admin, 1)).not.toThrow();
    });

    it('forbids other users', () => {
      expect(() => call(stranger, 1)).toThrow(ForbiddenException);
      expect(userService[handler === 'findOne' ? 'findById' : handler])
        .not.toHaveBeenCalled();
    });
  });
});

describe('UserEntity serialization', () => {
  it('does not expose the password', () => {
    const user = Object.assign(new UserEntity(), {
      id: 1,
      fullName: 'Test',
      password: 'secret',
    });

    expect(classToPlain(user)).toEqual({ id: 1, fullName: 'Test' });
  });
});
