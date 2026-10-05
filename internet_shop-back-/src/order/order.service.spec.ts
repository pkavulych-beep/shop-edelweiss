import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderService } from './order.service';

describe('OrderService', () => {
  it('does not create an order with a hidden product', async () => {
    const repository = { save: jest.fn() };
    const productService = {
      assertPurchasable: jest.fn().mockRejectedValue(new NotFoundException()),
    };
    const userService = { findOne: jest.fn() };
    const service = new OrderService(repository as any, productService as any, userService as any);

    await expect(
      service.create(1, {
        productId: [1, 5],
        comment: '',
        cityName: 'Київ',
        department: '1',
        size: 'M',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(productService.assertPurchasable).toHaveBeenCalledWith([1, 5]);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('creates the order for the user from the token', async () => {
    const user = { id: 3 };
    const repository = {
      save: jest.fn().mockResolvedValue({ id: 10 }),
      findOne: jest.fn().mockResolvedValue({ id: 10, productsInOrder: [] }),
    };
    const productService = {
      assertPurchasable: jest.fn().mockResolvedValue(undefined),
      findProductMain: jest.fn(),
    };
    const userService = { findOne: jest.fn().mockResolvedValue(user) };
    const service = new OrderService(repository as any, productService as any, userService as any);

    await service.create(3, {
      productId: [],
      comment: '',
      cityName: 'Київ',
      department: '1',
      size: 'M',
    });

    expect(userService.findOne).toHaveBeenCalledWith(3);
    expect(repository.save.mock.calls[0][0]).toMatchObject({ user });
  });

  describe('findOneForUser', () => {
    const order = { id: 10, user: { id: 3 }, productsInOrder: [] };
    let service: OrderService;

    beforeEach(() => {
      const repository = {
        findOne: jest.fn(({ where }) =>
          Promise.resolve(where.id === order.id ? { ...order } : null),
        ),
      };
      service = new OrderService(repository as any, {} as any, {} as any);
    });

    it('returns the order to its owner without the user relation', async () => {
      await expect(
        service.findOneForUser(10, { id: 3, roles: [{ value: 'USER' }] }),
      ).resolves.toEqual({ id: 10, productsInOrder: [] });
    });

    it('returns any order to ADMIN', async () => {
      await expect(
        service.findOneForUser(10, { id: 1, roles: [{ value: 'ADMIN' }] }),
      ).resolves.toEqual({ id: 10, productsInOrder: [] });
    });

    it('forbids another user', async () => {
      await expect(
        service.findOneForUser(10, { id: 4, roles: [{ value: 'USER' }] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFound for a missing order', async () => {
      await expect(
        service.findOneForUser(99, { id: 3, roles: [] }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
