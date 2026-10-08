import { GUARDS_METADATA } from '@nestjs/common/constants';
import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/roles-auth.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { QuickOrderController } from './quick-order.controller';
import { QuickOrderService } from './quick-order.service';

describe('QuickOrderController', () => {
  let controller: QuickOrderController;
  let service: jest.Mocked<QuickOrderService>;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      remove: jest.fn().mockResolvedValue('Заявку видалено'),
    } as any;
    controller = new QuickOrderController(service);
  });

  describe('guards', () => {
    const reflector = new Reflector();
    const handler = (name: string) => QuickOrderController.prototype[name];

    it('create is open to guests', () => {
      expect(Reflect.getMetadata(GUARDS_METADATA, handler('create'))).toBeUndefined();
    });

    it.each(['findAll', 'remove'])('%s requires ADMIN', name => {
      expect(Reflect.getMetadata(GUARDS_METADATA, handler(name))).toContain(RolesGuard);
      expect(reflector.get<string[]>(ROLES_KEY, handler(name))).toEqual(['ADMIN']);
    });
  });

  describe('remove', () => {
    it.each([
      ['too large id', 99999999999],
      ['zero', 0],
      ['negative', -1],
    ])('returns 404 for %s without calling service', async (_name, id) => {
      await expect(controller.remove(id)).rejects.toBeInstanceOf(NotFoundException);
      expect(service.remove).not.toHaveBeenCalled();
    });

    it('calls service.remove for valid id', async () => {
      await controller.remove(42);
      expect(service.remove).toHaveBeenCalledWith(42);
    });
  });
});
