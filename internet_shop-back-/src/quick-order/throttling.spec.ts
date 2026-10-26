import { ThrottlerException, ThrottlerStorageService, seconds } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { QuickOrderController } from './quick-order.controller';
import {
  QUICK_ORDER_LIMIT,
  QUICK_ORDER_TTL,
  QUICK_ORDER_THROTTLE_MESSAGE,
  QuickOrderThrottlerGuard,
} from './throttling';

describe('ліміт заявок «Замовити в 1 клік»', () => {
  let storage: ThrottlerStorageService;
  let guard: QuickOrderThrottlerGuard;

  const contextFor = (ip = '203.0.113.7') => {
    const res = {
      header: jest.fn(),
    };
    return {
      context: {
        getHandler: () => QuickOrderController.prototype.create,
        getClass: () => QuickOrderController,
        switchToHttp: () => ({
          getRequest: () => ({ ip, headers: {} }),
          getResponse: () => res,
          getNext: () => undefined,
        }),
      } as any,
    };
  };

  beforeEach(async () => {
    storage = new ThrottlerStorageService();
    guard = new QuickOrderThrottlerGuard(
      { throttlers: [{ limit: QUICK_ORDER_LIMIT, ttl: QUICK_ORDER_TTL }] } as any,
      storage,
      new Reflector(),
    );
    await guard.onModuleInit();
  });

  afterEach(async () => {
    await storage.onApplicationShutdown();
    jest.useRealTimers();
  });

  it('пропускає 5 заявок за 10 хвилин, а шосту відхиляє з 429', async () => {
    const { context } = contextFor();

    for (let attempt = 1; attempt <= QUICK_ORDER_LIMIT; attempt++) {
      await expect(guard.canActivate(context)).resolves.toBe(true);
    }

    const error = await guard.canActivate(context).catch(e => e);
    expect(error.getStatus()).toBe(429);
    expect(error.message).toBe(QUICK_ORDER_THROTTLE_MESSAGE);
  });

  it('рахує заявки окремо для різних IP', async () => {
    const first = contextFor('203.0.113.7');
    const second = contextFor('203.0.113.8');

    for (let attempt = 1; attempt <= QUICK_ORDER_LIMIT; attempt++) {
      await guard.canActivate(first.context);
    }
    await expect(guard.canActivate(first.context)).rejects.toBeInstanceOf(ThrottlerException);
    await expect(guard.canActivate(second.context)).resolves.toBe(true);
  });

  it('через 10 хвилин дозволяє заявки знову', async () => {
    jest.useFakeTimers();
    const start = Date.now();
    const { context } = contextFor();

    for (let attempt = 1; attempt <= QUICK_ORDER_LIMIT; attempt++) {
      await guard.canActivate(context);
    }
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ThrottlerException);

    jest.setSystemTime(start + QUICK_ORDER_TTL + 1000);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('5 заявок, вікно — 10 хвилин', () => {
    expect(QUICK_ORDER_TTL).toBe(seconds(600));
    expect(QUICK_ORDER_LIMIT).toBe(5);
  });
});
