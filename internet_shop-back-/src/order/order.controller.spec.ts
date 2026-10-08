import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/roles-auth.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ParseIdPipe } from '../common/parse-id.pipe';
import { OrderController } from './order.controller';

describe('OrderController guards', () => {
  const reflector = new Reflector();
  const handler = (name: string) => OrderController.prototype[name];

  it.each(['create', 'findOne', 'findMy'])('%s requires a JWT', name => {
    expect(Reflect.getMetadata(GUARDS_METADATA, handler(name))).toContain(JwtAuthGuard);
  });

  it.each(['findAll', 'updateStatus', 'update', 'remove'])('%s requires ADMIN', name => {
    expect(Reflect.getMetadata(GUARDS_METADATA, handler(name))).toContain(RolesGuard);
    expect(reflector.get<string[]>(ROLES_KEY, handler(name))).toEqual(['ADMIN']);
  });

  it('has no separate route for incomplete orders', () => {
    expect(handler('findIncomplete')).toBeUndefined();
  });
});

describe('OrderController :id', () => {
  it.each(['findOne', 'updateStatus', 'remove'])('%s parses id with ParseIdPipe', name => {
    const args = Object.values(Reflect.getMetadata(ROUTE_ARGS_METADATA, OrderController, name)) as {
      data?: string;
      pipes: unknown[];
    }[];
    expect(args.find(arg => arg.data === 'id').pipes.some(pipe => pipe instanceof ParseIdPipe)).toBe(
      true,
    );
  });
});
