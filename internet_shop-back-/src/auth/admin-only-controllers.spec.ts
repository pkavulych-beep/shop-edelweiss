import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles-auth.decorator';
import { RolesGuard } from './roles.guard';
import { RolesController } from '../roles/roles.controller';
import { PhotosController } from '../photos/photos.controller';

describe('admin-only controllers', () => {
  const reflector = new Reflector();

  const cases: [string, any, string[]][] = [
    ['RolesController', RolesController, ['create', 'getByValue']],
    ['PhotosController', PhotosController, ['create', 'remove']],
  ];

  describe.each(cases)('%s', (_, controller, handlers) => {
    it('is guarded by RolesGuard', () => {
      expect(Reflect.getMetadata(GUARDS_METADATA, controller)).toContain(
        RolesGuard,
      );
    });

    it.each(handlers)('requires ADMIN for %s', (handler) => {
      const roles = reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        controller.prototype[handler],
        controller,
      ]);
      expect(roles).toEqual(['ADMIN']);
    });
  });
});
