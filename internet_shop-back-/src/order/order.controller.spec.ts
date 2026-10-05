import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/roles-auth.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrderController } from './order.controller';

describe('OrderController guards', () => {
  const reflector = new Reflector();
  const handler = (name: string) => OrderController.prototype[name];

  it.each(['create', 'findOne', 'findMy'])('%s requires a JWT', (name) => {
    expect(Reflect.getMetadata(GUARDS_METADATA, handler(name))).toContain(
      JwtAuthGuard,
    );
  });

  it.each(['findAll', 'findIncomplete', 'update', 'remove'])(
    '%s requires ADMIN',
    (name) => {
      expect(Reflect.getMetadata(GUARDS_METADATA, handler(name))).toContain(
        RolesGuard,
      );
      expect(reflector.get<string[]>(ROLES_KEY, handler(name))).toEqual([
        'ADMIN',
      ]);
    },
  );
});
