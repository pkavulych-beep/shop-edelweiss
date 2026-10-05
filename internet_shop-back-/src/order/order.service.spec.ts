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

  describe('create', () => {
    const dto = {
      productId: [1, 2],
      comment: '',
      cityName: 'Київ',
      department: '1',
      size: 'M',
    };
    const user = { id: 3 };
    const products = [{ id: 1 }, { id: 2 }];
    let manager;
    let repository;
    let productService;
    let service: OrderService;

    beforeEach(() => {
      manager = {
        save: jest.fn((_target, order) => Promise.resolve({ id: 10, ...order })),
      };
      repository = {
        save: jest.fn(),
        manager: { transaction: jest.fn((work) => work(manager)) },
      };
      productService = {
        assertPurchasable: jest.fn().mockResolvedValue(undefined),
        findProductsMain: jest.fn().mockResolvedValue(products),
      };
      const userService = { findOne: jest.fn().mockResolvedValue(user) };
      service = new OrderService(repository, productService, userService as any);
    });

    it('saves the order for the token user with all products in one transaction', async () => {
      const result = await service.create(3, dto);

      expect(productService.findProductsMain).toHaveBeenCalledTimes(1);
      expect(productService.findProductsMain).toHaveBeenCalledWith([1, 2], manager);
      expect(manager.save).toHaveBeenCalledTimes(1);
      expect(manager.save.mock.calls[0][1]).toMatchObject({
        user,
        productsInOrder: products,
      });
      expect(repository.save).not.toHaveBeenCalled();
      expect(result).toMatchObject({ id: 10, productsInOrder: products });
      expect(result).not.toHaveProperty('user');
    });

    it('does not save the order when a product is missing', async () => {
      productService.findProductsMain.mockRejectedValue(new NotFoundException());

      await expect(service.create(3, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(manager.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    let manager;
    let productService;
    let service: OrderService;

    beforeEach(() => {
      manager = { save: jest.fn((order) => Promise.resolve(order)) };
      const repository = {
        findOne: jest.fn().mockResolvedValue({ id: 10, comment: 'old' }),
        manager: { transaction: jest.fn((work) => work(manager)) },
      };
      productService = {
        findProductsMain: jest.fn().mockResolvedValue([{ id: 7 }]),
      };
      service = new OrderService(repository as any, productService, {} as any);
    });

    it('replaces the products before saving', async () => {
      const result = await service.update({ id: 10, productId: [7] } as any);

      expect(productService.findProductsMain).toHaveBeenCalledWith([7], manager);
      expect(manager.save).toHaveBeenCalledTimes(1);
      expect(result.productsInOrder).toEqual([{ id: 7 }]);
    });

    it('keeps the products when productId is not given', async () => {
      const result = await service.update({ id: 10, comment: 'new' } as any);

      expect(productService.findProductsMain).not.toHaveBeenCalled();
      expect(result).not.toHaveProperty('productsInOrder');
      expect(result.comment).toBe('new');
    });

    it('does not save a product that is not found', async () => {
      productService.findProductsMain.mockRejectedValue(new NotFoundException());

      await expect(
        service.update({ id: 10, productId: [99] } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(manager.save).not.toHaveBeenCalled();
    });
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
