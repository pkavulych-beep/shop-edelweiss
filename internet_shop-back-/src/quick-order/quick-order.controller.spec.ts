import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/roles-auth.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ParseIdPipe } from '../common/parse-id.pipe';
import { QuickOrderController } from './quick-order.controller';
import { QuickOrderService } from './quick-order.service';
import { QUICK_ORDER_LIMIT, QUICK_ORDER_TTL, QuickOrderThrottlerGuard } from './throttling';

const THROTTLER_LIMIT = 'THROTTLER:LIMITdefault';
const THROTTLER_TTL = 'THROTTLER:TTLdefault';

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

    it('create is open to guests (no auth or roles guard)', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, handler('create')) ?? [];
      expect(guards).not.toContain(RolesGuard);
      expect(guards.filter(g => g !== QuickOrderThrottlerGuard)).toEqual([]);
    });

    it('create is throttled: 5 requests per 10 minutes', () => {
      expect(Reflect.getMetadata(GUARDS_METADATA, handler('create'))).toContain(
        QuickOrderThrottlerGuard,
      );
      expect(Reflect.getMetadata(THROTTLER_LIMIT, handler('create'))).toBe(QUICK_ORDER_LIMIT);
      expect(Reflect.getMetadata(THROTTLER_TTL, handler('create'))).toBe(QUICK_ORDER_TTL);
    });

    it.each(['findAll', 'remove'])('%s requires ADMIN', name => {
      expect(Reflect.getMetadata(GUARDS_METADATA, handler(name))).toContain(RolesGuard);
      expect(reflector.get<string[]>(ROLES_KEY, handler(name))).toEqual(['ADMIN']);
    });
  });

  describe('remove', () => {
    it('checks the id range in the shared ParseIdPipe, not in the handler', () => {
      const args = Object.values(
        Reflect.getMetadata(ROUTE_ARGS_METADATA, QuickOrderController, 'remove'),
      ) as { data?: string; pipes: unknown[] }[];
      expect(args.find(arg => arg.data === 'id').pipes.some(pipe => pipe instanceof ParseIdPipe)).toBe(
        true,
      );
    });

    it('calls service.remove for valid id', async () => {
      await controller.remove(42);
      expect(service.remove).toHaveBeenCalledWith(42);
    });
  });
});
