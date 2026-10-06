import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/roles-auth.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { QuickOrderController } from './quick-order.controller';

describe('QuickOrderController guards', () => {
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
