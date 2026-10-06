import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { Status } from './statusEnum';

describe('OrderService', () => {
  describe('create', () => {
    const user = { id: 3 };
    const products = [
      { id: 1, sizes: ['S', 'M'], price: 500, salePrice: null },
      { id: 5, sizes: ['L'], price: 1000, salePrice: 800 },
    ];
    const delivery = { comment: '', cityName: 'Київ', department: '1' };
    let repository;
    let productService;
    let userService;
    let service: OrderService;

    beforeEach(() => {
      repository = {
        save: jest.fn().mockResolvedValue({ id: 10 }),
        findOne: jest.fn().mockResolvedValue({ id: 10, items: [] }),
      };
      productService = {
        findPurchasable: jest.fn((ids: number[]) =>
          Promise.resolve(products.filter((p) => ids.includes(p.id))),
        ),
      };
      userService = { findOne: jest.fn().mockResolvedValue(user) };
      service = new OrderService(repository, productService, userService);
    });

    it('saves items with size, quantity and the price from the database', async () => {
      await service.create(3, {
        ...delivery,
        items: [
          { productId: 1, size: 'M', quantity: 2 },
          { productId: 5, size: 'L', quantity: 1 },
        ],
      });

      expect(userService.findOne).toHaveBeenCalledWith(3);
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.save.mock.calls[0][0]).toMatchObject({
        user,
        ...delivery,
        items: [
          { productId: 1, size: 'M', quantity: 2, price: 500 },
          { productId: 5, size: 'L', quantity: 1, price: 800 },
        ],
        total: 1800,
      });
    });

    it('keeps different sizes of one product as separate items', async () => {
      await service.create(3, {
        ...delivery,
        items: [
          { productId: 1, size: 'S', quantity: 1 },
          { productId: 1, size: 'M', quantity: 1 },
          { productId: 1, size: 'S', quantity: 2 },
        ],
      });

      expect(productService.findPurchasable).toHaveBeenCalledWith([1]);
      expect(repository.save.mock.calls[0][0]).toMatchObject({
        items: [
          { productId: 1, size: 'S', quantity: 3, price: 500 },
          { productId: 1, size: 'M', quantity: 1, price: 500 },
        ],
        total: 2000,
      });
    });

    it('returns the saved order with its items', async () => {
      await expect(
        service.create(3, {
          ...delivery,
          items: [{ productId: 1, size: 'M', quantity: 1 }],
        }),
      ).resolves.toEqual({ id: 10, items: [] });
      expect(repository.findOne.mock.calls[0][0]).toMatchObject({
        where: { id: 10 },
      });
    });

    it('does not create an order with a hidden or missing product', async () => {
      await expect(
        service.create(3, {
          ...delivery,
          items: [
            { productId: 1, size: 'M', quantity: 1 },
            { productId: 7, size: 'M', quantity: 1 },
          ],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('does not create an order with a size the product does not have', async () => {
      await expect(
        service.create(3, {
          ...delivery,
          items: [{ productId: 5, size: 'XS', quantity: 1 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findOneForUser', () => {
    const order = { id: 10, user: { id: 3 }, items: [] };
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
      ).resolves.toEqual({ id: 10, items: [] });
    });

    it('returns any order to ADMIN', async () => {
      await expect(
        service.findOneForUser(10, { id: 1, roles: [{ value: 'ADMIN' }] }),
      ).resolves.toEqual({ id: 10, items: [] });
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

  describe('update', () => {
    it('changes only the fields from the request', async () => {
      const repository = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          status: Status.Processed,
          comment: 'Подзвоніть',
          total: 1800,
        }),
        save: jest.fn((order) => Promise.resolve(order)),
      };
      const service = new OrderService(repository as any, {} as any, {} as any);

      await expect(
        service.update({ id: 10, status: Status.Sent, comment: undefined }),
      ).resolves.toEqual({
        id: 10,
        status: Status.Sent,
        comment: 'Подзвоніть',
        total: 1800,
      });
    });
  });

  describe('findUserOrders', () => {
    it('loads the user orders with items in one query, newest first', async () => {
      const orders = [{ id: 11, items: [{ id: 1, size: 'M', quantity: 2 }] }];
      const repository = { find: jest.fn().mockResolvedValue(orders) };
      const service = new OrderService(repository as any, {} as any, {} as any);

      await expect(service.findUserOrders(3)).resolves.toBe(orders);
      expect(repository.find).toHaveBeenCalledTimes(1);
      expect(repository.find).toHaveBeenCalledWith({
        relations: { items: { product: true } },
        where: { user: { id: 3 } },
        order: { createdAt: 'DESC', id: 'DESC', items: { id: 'ASC' } },
      });
    });
  });
});
