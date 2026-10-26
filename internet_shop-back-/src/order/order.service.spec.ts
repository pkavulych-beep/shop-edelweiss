import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderService } from './order.service';
import { Status } from './statusEnum';
import { PaymentMethod, PaymentStatus } from './paymentEnum';
import { DeliveryMethod } from './deliveryEnum';
import { ProductEntity } from '../product/entities/product.entity';
import { OrderEntity } from './entities/order.entity';
import { BasketItemEntity } from '../user/entities/basket-item.entity';

describe('OrderService', () => {
  describe('create', () => {
    const user = { id: 3 };
    const products = [
      { id: 1, sizes: ['S', 'M'], price: 500, salePrice: null, count: 10, status: 'active' },
      { id: 5, sizes: ['L'], price: 1000, salePrice: 800, count: 10, status: 'active' },
    ];
    const delivery = { comment: '', cityName: 'Київ', department: '1' };
    let repository;
    let productService;
    let userService;
    let service: OrderService;
    let mockManager;

    beforeEach(() => {
      mockManager = {
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ id: 10, ...data })),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        findOne: jest.fn().mockImplementation((entity, options) => {
          // Return order for OrderEntity, product for ProductEntity
          if (entity.name === 'OrderEntity' || (entity && entity.name === 'order')) {
            return Promise.resolve({ id: options.where.id, items: [], user: { id: 3 } });
          }
          return Promise.resolve({ id: options.where.id, count: 10, status: 'active' });
        }),
        transaction: jest.fn().mockImplementation(async (callback) => {
          return callback(mockManager);
        }),
      };
      repository = {
        save: jest.fn().mockResolvedValue({ id: 10 }),
        findOne: jest.fn().mockResolvedValue({ id: 10, items: [] }),
        manager: mockManager,
      };
      productService = {
        findPurchasable: jest.fn((ids: number[]) =>
          Promise.resolve(products.filter(p => ids.includes(p.id))),
        ),
      };
      userService = { findOne: jest.fn().mockResolvedValue(user) };
      service = new OrderService(repository, productService, userService);
    });

    afterEach(() => {
      delete process.env.MONO_ACQUIRING_TOKEN;
      delete process.env.BASE_URL;
      delete process.env.FRONTEND_URL;
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
      expect(mockManager.save).toHaveBeenCalledTimes(3); // OrderEntity + 2 ProductEntity
      expect(mockManager.save.mock.calls[0][1]).toMatchObject({
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
      expect(mockManager.save.mock.calls[0][1]).toMatchObject({
        items: [
          { productId: 1, size: 'S', quantity: 3, price: 500 },
          { productId: 1, size: 'M', quantity: 1, price: 500 },
        ],
        total: 2000,
      });
    });

    it('defaults a new order to cash on delivery and unpaid', async () => {
      await service.create(3, {
        ...delivery,
        items: [{ productId: 1, size: 'M', quantity: 1 }],
      });

      expect(mockManager.save.mock.calls[0][1]).toMatchObject({
        paymentMethod: PaymentMethod.Cod,
        paymentStatus: PaymentStatus.NotRequired,
      });
    });

    it('keeps the card payment method chosen by the client when acquiring is configured', async () => {
      process.env.MONO_ACQUIRING_TOKEN = 'test-token';
      process.env.BASE_URL = 'http://localhost:7777/';
      process.env.FRONTEND_URL = 'http://localhost:3000/';

      await service.create(3, {
        ...delivery,
        paymentMethod: PaymentMethod.Card,
        items: [{ productId: 1, size: 'M', quantity: 1 }],
      });

      expect(mockManager.save.mock.calls[0][1]).toMatchObject({
        paymentMethod: PaymentMethod.Card,
        paymentStatus: PaymentStatus.NotRequired,
      });
    });

    it('rejects card payment and creates no order without mono token', async () => {
      delete process.env.MONO_ACQUIRING_TOKEN;
      process.env.BASE_URL = 'http://localhost:7777/';
      process.env.FRONTEND_URL = 'http://localhost:3000/';

      await expect(
        service.create(3, {
          ...delivery,
          paymentMethod: PaymentMethod.Card,
          items: [{ productId: 1, size: 'M', quantity: 1 }],
        }),
      ).rejects.toThrow('Оплата карткою зараз недоступна');

      expect(mockManager.transaction).not.toHaveBeenCalled();
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('rejects card payment when BASE_URL or FRONTEND_URL is missing', async () => {
      process.env.MONO_ACQUIRING_TOKEN = 'test-token';
      delete process.env.BASE_URL;
      delete process.env.FRONTEND_URL;

      await expect(
        service.create(3, {
          ...delivery,
          paymentMethod: PaymentMethod.Card,
          items: [{ productId: 1, size: 'M', quantity: 1 }],
        }),
      ).rejects.toThrow('Оплата карткою зараз недоступна');

      expect(mockManager.transaction).not.toHaveBeenCalled();
    });

    it('defaults a new order to Nova Poshta', async () => {
      await service.create(3, {
        ...delivery,
        items: [{ productId: 1, size: 'M', quantity: 1 }],
      });

      expect(mockManager.save.mock.calls[0][1].deliveryMethod).toBe(
        DeliveryMethod.NovaPoshta,
      );
    });

    it('keeps the delivery method chosen by the client', async () => {
      await service.create(3, {
        ...delivery,
        deliveryMethod: DeliveryMethod.Ukrposhta,
        department: '79000',
        items: [{ productId: 1, size: 'M', quantity: 1 }],
      });

      expect(mockManager.save.mock.calls[0][1]).toMatchObject({
        deliveryMethod: DeliveryMethod.Ukrposhta,
        department: '79000',
      });
    });

    it('ignores the payment status from the body', async () => {
      await service.create(3, {
        ...delivery,
        items: [{ productId: 1, size: 'M', quantity: 1 }],
        paymentStatus: PaymentStatus.Paid,
      } as any);

      expect(mockManager.save.mock.calls[0][1].paymentStatus).toBe(
        PaymentStatus.NotRequired,
      );
    });

    it('clears the user cart in the same transaction as order creation', async () => {
      await service.create(3, {
        ...delivery,
        items: [{ productId: 1, size: 'M', quantity: 1 }],
      });

      expect(mockManager.delete).toHaveBeenCalledWith(BasketItemEntity, { userId: 3 });
    });

    it('returns the saved order with its items', async () => {
      await expect(
        service.create(3, {
          ...delivery,
          items: [{ productId: 1, size: 'M', quantity: 1 }],
        }),
      ).resolves.toMatchObject({ id: 10, items: [] });
      expect(mockManager.findOne).toHaveBeenCalledWith(
        expect.any(Function), // OrderEntity
        expect.objectContaining({ where: { id: 10 } })
      );
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
      expect(mockManager.transaction).not.toHaveBeenCalled();
    });


    it('creates an order for a product without sizes with no size provided', async () => {
      productService.findPurchasable.mockResolvedValueOnce([
        { id: 2, sizes: [], price: 300, salePrice: null, count: 10, status: 'active' },
      ]);
      await service.create(3, {
        ...delivery,
        items: [{ productId: 2, quantity: 1 }],
      });
      expect(mockManager.save).toHaveBeenCalled();
      const saved = mockManager.save.mock.calls[0][1];
      expect(saved.items).toEqual([{ productId: 2, size: '', quantity: 1, price: 300 }]);
    });

    it('rejects order for product with sizes if size not provided', async () => {
      await expect(
        service.create(3, {
          ...delivery,
          items: [{ productId: 1, quantity: 1 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects order with non-existent size', async () => {
      await expect(
        service.create(3, {
          ...delivery,
          items: [{ productId: 1, size: 'XXL', quantity: 1 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
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

    it('rejects order when total quantity across sizes exceeds stock', async () => {
      // Product 1 has count=10, ordering 6 of size S + 5 of size M = 11 total > 10
      await expect(
        service.create(3, {
          ...delivery,
          items: [
            { productId: 1, size: 'S', quantity: 6 },
            { productId: 1, size: 'M', quantity: 5 },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockManager.transaction).not.toHaveBeenCalled();
    });

    it('decrements stock correctly for each product', async () => {
      await service.create(3, {
        ...delivery,
        items: [
          { productId: 1, size: 'S', quantity: 2 },
          { productId: 5, size: 'L', quantity: 3 },
        ],
      });

      // Check that product 1 and 5 were decremented
      const productSaves = mockManager.save.mock.calls.filter(
        call => call[0]?.name === 'ProductEntity' || call[0] === ProductEntity
      );
      expect(productSaves.length).toBe(2);

      // Product 1: count was 10, ordered 2 -> should be 8
      const product1Save = productSaves.find(call => call[1].id === 1);
      expect(product1Save).toBeDefined();
      expect(product1Save[1].count).toBe(8);

      // Product 5: count was 10, ordered 3 -> should be 7
      const product5Save = productSaves.find(call => call[1].id === 5);
      expect(product5Save).toBeDefined();
      expect(product5Save[1].count).toBe(7);
    });

    it('allows ordering product with count = null (no stock tracking)', async () => {
      productService.findPurchasable.mockResolvedValueOnce([
        { id: 3, sizes: ['M'], price: 200, salePrice: null, count: null, status: 'active' },
      ]);
      // Mock findOne to return count: null for product 3
      mockManager.findOne.mockImplementationOnce((entity, options) => {
        if (entity === ProductEntity || (entity && entity.name === 'ProductEntity')) {
          return Promise.resolve({ id: options.where.id, count: null, status: 'active' });
        }
        return Promise.resolve({ id: options.where.id, items: [], user: { id: 3 } });
      });

      await service.create(3, {
        ...delivery,
        items: [{ productId: 3, size: 'M', quantity: 100 }],
      });

      // Product save should not be called for product with count = null
      const productSaves = mockManager.save.mock.calls.filter(
        call => call[0]?.name === 'ProductEntity' || call[0] === ProductEntity
      );
      expect(productSaves.length).toBe(0);
    });

    it('rolls back transaction when stock insufficient inside transaction', async () => {
      // Mock findOne to return count: 3 (less than requested 5) for product 1
      mockManager.findOne.mockImplementationOnce((entity, options) => {
        if (entity === ProductEntity || (entity && entity.name === 'ProductEntity')) {
          return Promise.resolve({ id: options.where.id, count: 3, status: 'active' });
        }
        return Promise.resolve({ id: options.where.id, items: [], user: { id: 3 } });
      });

      await expect(
        service.create(3, {
          ...delivery,
          items: [{ productId: 1, size: 'M', quantity: 5 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      // The order is saved before the stock is checked: what matters is that no product is saved
      const productSaves = mockManager.save.mock.calls.filter(
        call => call[0]?.name === 'ProductEntity' || call[0] === ProductEntity
      );
      expect(productSaves.length).toBe(0);
    });

    describe('with stock per size', () => {
      const sized = {
        id: 7, sizes: ['S', 'M'], sizeStock: { S: 2, M: 0 }, price: 400, salePrice: null, count: 2, status: 'active',
      };
      const productSaves = () =>
        mockManager.save.mock.calls.filter(call => call[0] === ProductEntity);

      beforeEach(() => {
        productService.findPurchasable.mockResolvedValue([sized]);
        mockManager.findOne.mockImplementation((entity, options) =>
          Promise.resolve(
            entity === ProductEntity
              ? { ...sized, sizeStock: { ...sized.sizeStock } }
              : { id: options.where.id, items: [], user: { id: 3 } },
          ),
        );
      });

      it('decrements the stock of the ordered size and the total count', async () => {
        await service.create(3, { ...delivery, items: [{ productId: 7, size: 'S', quantity: 2 }] });

        expect(productSaves()).toHaveLength(1);
        expect(productSaves()[0][1]).toMatchObject({ sizeStock: { S: 0, M: 0 }, count: 0 });
      });

      it('rejects more than the stock of the size', async () => {
        await expect(
          service.create(3, { ...delivery, items: [{ productId: 7, size: 'S', quantity: 3 }] }),
        ).rejects.toThrow('Недостатньо товару на складі. Доступно: 2');
        expect(mockManager.transaction).not.toHaveBeenCalled();
      });

      it('rejects a size that is out of stock', async () => {
        await expect(
          service.create(3, { ...delivery, items: [{ productId: 7, size: 'M', quantity: 1 }] }),
        ).rejects.toThrow('Розміру M немає в наявності');
      });

      it('checks the stock again inside the transaction', async () => {
        mockManager.findOne.mockImplementationOnce(() =>
          Promise.resolve({ ...sized, sizeStock: { S: 1, M: 0 }, count: 1 }),
        );

        await expect(
          service.create(3, { ...delivery, items: [{ productId: 7, size: 'S', quantity: 2 }] }),
        ).rejects.toThrow('Доступно: 1');
        expect(productSaves()).toHaveLength(0);
      });
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

    it('returns any order to ADMIN together with the buyer', async () => {
      await expect(
        service.findOneForUser(10, { id: 1, roles: [{ value: 'ADMIN' }] }),
      ).resolves.toEqual(order);
    });

    it('forbids another user', async () => {
      await expect(
        service.findOneForUser(10, { id: 4, roles: [{ value: 'USER' }] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFound for a missing order', async () => {
      await expect(service.findOneForUser(99, { id: 3, roles: [] })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('changes only the fields from the request', async () => {
      const mockManager = {
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ ...data })),
        findOne: jest.fn().mockImplementation((entity, options) => {
          if (entity === OrderEntity || (entity && entity.name === 'OrderEntity')) {
            return Promise.resolve({ id: options.where.id, items: [], status: Status.Processed, comment: 'Подзвоніть', total: 1800 });
          }
          return Promise.resolve({ id: options.where.id, count: 10, status: 'active' });
        }),
        transaction: jest.fn().mockImplementation(async (callback) => callback(mockManager)),
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          status: Status.Processed,
          comment: 'Подзвоніть',
          total: 1800,
          items: [],
        }),
        save: jest.fn(order => Promise.resolve(order)),
        manager: mockManager,
      };
      const service = new OrderService(repository as any, {} as any, {} as any);

      await expect(
        service.update({ id: 10, comment: 'New comment' }),
      ).resolves.toEqual({
        id: 10,
        status: Status.Processed,
        comment: 'New comment',
        total: 1800,
        items: [],
      });
    });

    it('delegates to updateStatus when status changes', async () => {
      const mockManager = {
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ ...data })),
        findOne: jest.fn().mockImplementation((entity, options) => {
          if (entity === OrderEntity || (entity && entity.name === 'OrderEntity')) {
            return Promise.resolve({ id: options.where.id, items: [{ productId: 1, quantity: 2 }], status: Status.Processed });
          }
          return Promise.resolve({ id: options.where.id, count: 5, status: 'active' });
        }),
        transaction: jest.fn().mockImplementation(async (callback) => callback(mockManager)),
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          status: Status.Processed,
          items: [{ productId: 1, quantity: 2 }],
        }),
        save: jest.fn(),
        manager: mockManager,
      };
      const service = new OrderService(repository as any, {} as any, {} as any);

      await service.update({ id: 10, status: Status.Sent });

      expect(mockManager.transaction).toHaveBeenCalled();
    });

    it('saves both status change and other fields when status changes', async () => {
      const mockManager = {
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ ...data })),
        findOne: jest.fn().mockImplementation((entity, options) => {
          if (entity === OrderEntity || (entity && entity.name === 'OrderEntity')) {
            return Promise.resolve({ id: options.where.id, items: [{ productId: 1, quantity: 2 }], status: Status.Processed, comment: 'Old comment', cityName: 'Kyiv' });
          }
          return Promise.resolve({ id: options.where.id, count: 5, status: 'active' });
        }),
        transaction: jest.fn().mockImplementation(async (callback) => callback(mockManager)),
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          status: Status.Processed,
          comment: 'Old comment',
          cityName: 'Kyiv',
          items: [{ productId: 1, quantity: 2 }],
        }),
        save: jest.fn(),
        manager: mockManager,
      };
      const service = new OrderService(repository as any, {} as any, {} as any);

      const result = await service.update({ id: 10, status: Status.Sent, comment: 'New comment' });

      expect(mockManager.transaction).toHaveBeenCalled();
      expect(result.status).toBe(Status.Sent);
      expect(result.comment).toBe('New comment');
      expect(result.cityName).toBe('Kyiv');
    });
  });

  describe('findAll', () => {
    let query;
    let service: OrderService;

    beforeEach(() => {
      query = {};
      for (const method of [
        'leftJoin',
        'addSelect',
        'loadRelationCountAndMap',
        'orderBy',
        'addOrderBy',
        'skip',
        'take',
        'where',
      ]) {
        query[method] = jest.fn().mockReturnValue(query);
      }
      query.getManyAndCount = jest.fn().mockResolvedValue([[{ id: 7 }], 41]);
      const repository = { createQueryBuilder: jest.fn().mockReturnValue(query) };
      service = new OrderService(repository as any, {} as any, {} as any);
    });

    it('returns a page of orders with the buyer and items count, newest first', async () => {
      await expect(service.findAll({ page: 3, limit: 20 })).resolves.toEqual({
        data: [{ id: 7 }],
        total: 41,
        page: 3,
        limit: 20,
      });
      expect(query.addSelect).toHaveBeenCalledWith([
        'user.id',
        'user.fullName',
        'user.phoneNumber',
      ]);
      expect(query.loadRelationCountAndMap).toHaveBeenCalledWith('o.itemsCount', 'o.items');
      expect(query.orderBy).toHaveBeenCalledWith('o.createdAt', 'DESC');
      expect(query.addOrderBy).toHaveBeenCalledWith('o.id', 'DESC');
      expect(query.skip).toHaveBeenCalledWith(40);
      expect(query.take).toHaveBeenCalledWith(20);
      expect(query.where).not.toHaveBeenCalled();
    });

    it('filters by status', async () => {
      await service.findAll({ page: 1, limit: 20, status: Status.Sent });
      expect(query.where).toHaveBeenCalledWith('o.status = :status', {
        status: Status.Sent,
      });
    });
  });

  describe('updateStatus', () => {
    it('saves the new status and keeps the other fields', async () => {
      const mockManager = {
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ ...data })),
        findOne: jest.fn().mockImplementation((entity, options) => {
          if (entity === OrderEntity || (entity && entity.name === 'OrderEntity')) {
            return Promise.resolve({ id: options.where.id, items: [], status: Status.Processed, comment: 'c' });
          }
          return Promise.resolve({ id: options.where.id, count: 10, status: 'active' });
        }),
        transaction: jest.fn().mockImplementation(async (callback) => callback(mockManager)),
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          status: Status.Processed,
          comment: 'c',
          items: [],
        }),
        save: jest.fn(order => Promise.resolve(order)),
        manager: mockManager,
      };
      const service = new OrderService(repository as any, {} as any, {} as any);

      await expect(service.updateStatus(10, Status.Sent)).resolves.toEqual({
        id: 10,
        status: Status.Sent,
        comment: 'c',
        items: [],
      });
      expect(mockManager.transaction).toHaveBeenCalled();
    });

    it('throws NotFound for a missing order', async () => {
      const mockManager = {
        save: jest.fn(),
        findOne: jest.fn().mockResolvedValue(null),
        transaction: jest.fn().mockImplementation(async (callback) => callback(mockManager)),
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn(),
        manager: mockManager,
      };
      const service = new OrderService(repository as any, {} as any, {} as any);

      await expect(service.updateStatus(99, Status.Sent)).rejects.toBeInstanceOf(NotFoundException);
      expect(mockManager.transaction).toHaveBeenCalled();
    });

    it('restores stock when cancelling an order', async () => {
      const mockManager = {
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ ...data })),
        findOne: jest.fn().mockImplementation((entity, options) => {
          if (entity === OrderEntity || (entity && entity.name === 'OrderEntity')) {
            return Promise.resolve({ id: options.where.id, items: [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }], status: Status.Processed });
          }
          if (entity === ProductEntity || (entity && entity.name === 'ProductEntity')) {
            return Promise.resolve({ id: options.where.id, count: 5, status: 'active' });
          }
          return Promise.resolve({ id: options.where.id, items: [], user: { id: 3 } });
        }),
        transaction: jest.fn().mockImplementation(async (callback) => callback(mockManager)),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          status: Status.Processed,
          items: [
            { productId: 1, quantity: 2 },
            { productId: 2, quantity: 1 },
          ],
        }),
        save: jest.fn(),
        manager: mockManager,
      };
      const service = new OrderService(repository as any, {} as any, {} as any);

      await service.updateStatus(10, Status.Canceled);

      expect(mockManager.transaction).toHaveBeenCalled();
      // Check that product counts were incremented
      const productSaves = mockManager.save.mock.calls.filter(
        call => call[0] === ProductEntity || (call[0] && call[0].name === 'ProductEntity')
      );
      expect(productSaves.length).toBe(2);
      // Product 1: count was 5, ordered 2 -> should be 7
      const product1Save = productSaves.find(call => call[1].id === 1);
      expect(product1Save).toBeDefined();
      expect(product1Save[1].count).toBe(7);
      // Product 2: count was 5, ordered 1 -> should be 6
      const product2Save = productSaves.find(call => call[1].id === 2);
      expect(product2Save).toBeDefined();
      expect(product2Save[1].count).toBe(6);
    });

    it('restores the stock of the ordered size when cancelling', async () => {
      const items = [
        { productId: 7, size: 'S', quantity: 2 },
        { productId: 7, size: 'M', quantity: 1 },
      ];
      const mockManager = {
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ ...data })),
        findOne: jest.fn().mockImplementation((entity, options) =>
          Promise.resolve(
            entity === ProductEntity
              ? { id: options.where.id, sizes: ['S', 'M'], sizeStock: { S: 0, M: 4 }, count: 4 }
              : { id: options.where.id, items, status: Status.Processed },
          ),
        ),
        transaction: jest.fn().mockImplementation(async (callback) => callback(mockManager)),
      };
      const repository = { manager: mockManager };
      const service = new OrderService(repository as any, {} as any, {} as any);

      await service.updateStatus(10, Status.Canceled);

      const productSaves = mockManager.save.mock.calls.filter(call => call[0] === ProductEntity);
      expect(productSaves).toHaveLength(1);
      expect(productSaves[0][1]).toMatchObject({ sizeStock: { S: 2, M: 5 }, count: 7 });
    });

    it('does not restore stock when cancelling an already cancelled order', async () => {
      const mockManager = {
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ ...data })),
        findOne: jest.fn().mockImplementation((entity, options) => {
          if (entity === OrderEntity || (entity && entity.name === 'OrderEntity')) {
            return Promise.resolve({ id: options.where.id, items: [{ productId: 1, quantity: 2 }], status: Status.Canceled });
          }
          if (entity === ProductEntity || (entity && entity.name === 'ProductEntity')) {
            return Promise.resolve({ id: options.where.id, count: 5, status: 'active' });
          }
          return Promise.resolve({ id: options.where.id, items: [], user: { id: 3 } });
        }),
        transaction: jest.fn().mockImplementation(async (callback) => callback(mockManager)),
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          status: Status.Canceled,
          items: [{ productId: 1, quantity: 2 }],
        }),
        save: jest.fn(order => Promise.resolve(order)),
        manager: mockManager,
      };
      const service = new OrderService(repository as any, {} as any, {} as any);

      await service.updateStatus(10, Status.Canceled);

      expect(mockManager.transaction).toHaveBeenCalled();
      const productSaves = mockManager.save.mock.calls.filter(
        call => call[0] === ProductEntity || (call[0] && call[0].name === 'ProductEntity')
      );
      expect(productSaves.length).toBe(0);
    });

    it('decrements stock when transitioning from Canceled to another status', async () => {
      const mockManager = {
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ ...data })),
        findOne: jest.fn().mockImplementation((entity, options) => {
          if (entity === OrderEntity || (entity && entity.name === 'OrderEntity')) {
            return Promise.resolve({ id: options.where.id, items: [{ productId: 1, quantity: 2 }], status: Status.Canceled });
          }
          if (entity === ProductEntity || (entity && entity.name === 'ProductEntity')) {
            return Promise.resolve({ id: options.where.id, count: 5, status: 'active' });
          }
          return Promise.resolve({ id: options.where.id, items: [], user: { id: 3 } });
        }),
        transaction: jest.fn().mockImplementation(async (callback) => callback(mockManager)),
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          status: Status.Canceled,
          items: [{ productId: 1, quantity: 2 }],
        }),
        save: jest.fn(order => Promise.resolve(order)),
        manager: mockManager,
      };
      const service = new OrderService(repository as any, {} as any, {} as any);

      await service.updateStatus(10, Status.Processed);

      expect(mockManager.transaction).toHaveBeenCalled();
      // Check that product count was decremented
      const productSaves = mockManager.save.mock.calls.filter(
        call => call[0] === ProductEntity || (call[0] && call[0].name === 'ProductEntity')
      );
      expect(productSaves.length).toBe(1);
      const product1Save = productSaves.find(call => call[1].id === 1);
      expect(product1Save).toBeDefined();
      // count was 5, ordered 2 -> should be 3 after decrement
      expect(product1Save[1].count).toBe(3);
    });

    it('throws BadRequestException when transitioning from Canceled but insufficient stock', async () => {
      const mockManager = {
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ ...data })),
        findOne: jest.fn().mockImplementation((entity, options) => {
          if (entity === OrderEntity || (entity && entity.name === 'OrderEntity')) {
            return Promise.resolve({ id: options.where.id, items: [{ productId: 1, quantity: 5 }], status: Status.Canceled });
          }
          if (entity === ProductEntity || (entity && entity.name === 'ProductEntity')) {
            return Promise.resolve({ id: options.where.id, count: 3, status: 'active' });
          }
          return Promise.resolve({ id: options.where.id, items: [], user: { id: 3 } });
        }),
        transaction: jest.fn().mockImplementation(async (callback) => callback(mockManager)),
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          status: Status.Canceled,
          items: [{ productId: 1, quantity: 5 }],
        }),
        save: jest.fn(order => Promise.resolve(order)),
        manager: mockManager,
      };
      const service = new OrderService(repository as any, {} as any, {} as any);

      await expect(service.updateStatus(10, Status.Processed)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('does not restore stock when changing to non-cancelled status', async () => {
      const mockManager = {
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ ...data })),
        findOne: jest.fn().mockImplementation((entity, options) => {
          if (entity === OrderEntity || (entity && entity.name === 'OrderEntity')) {
            return Promise.resolve({ id: options.where.id, items: [{ productId: 1, quantity: 2 }], status: Status.Processed });
          }
          if (entity === ProductEntity || (entity && entity.name === 'ProductEntity')) {
            return Promise.resolve({ id: options.where.id, count: 5, status: 'active' });
          }
          return Promise.resolve({ id: options.where.id, items: [], user: { id: 3 } });
        }),
        transaction: jest.fn().mockImplementation(async (callback) => callback(mockManager)),
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          status: Status.Processed,
          items: [{ productId: 1, quantity: 2 }],
        }),
        save: jest.fn(order => Promise.resolve(order)),
        manager: mockManager,
      };
      const service = new OrderService(repository as any, {} as any, {} as any);

      await service.updateStatus(10, Status.Sent);

      expect(mockManager.transaction).toHaveBeenCalled();
      const productSaves = mockManager.save.mock.calls.filter(
        call => call[0] === ProductEntity || (call[0] && call[0].name === 'ProductEntity')
      );
      expect(productSaves.length).toBe(0);
    });

    it('skips product count restoration for products with count = null', async () => {
      const mockManager = {
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ ...data })),
        findOne: jest.fn().mockImplementation((entity, options) => {
          if (entity === OrderEntity || (entity && entity.name === 'OrderEntity')) {
            return Promise.resolve({ id: options.where.id, items: [{ productId: 1, quantity: 2 }], status: Status.Processed });
          }
          if (entity === ProductEntity || (entity && entity.name === 'ProductEntity')) {
            return Promise.resolve({ id: options.where.id, count: null, status: 'active' });
          }
          return Promise.resolve({ id: options.where.id, items: [], user: { id: 3 } });
        }),
        transaction: jest.fn().mockImplementation(async (callback) => callback(mockManager)),
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          status: Status.Processed,
          items: [{ productId: 1, quantity: 2 }],
        }),
        save: jest.fn(),
        manager: mockManager,
      };
      const service = new OrderService(repository as any, {} as any, {} as any);

      await service.updateStatus(10, Status.Canceled);

      const productSaves = mockManager.save.mock.calls.filter(
        call => call[0] === ProductEntity || (call[0] && call[0].name === 'ProductEntity')
      );
      expect(productSaves.length).toBe(0);
    });
  });

  describe('cancelUnpaidOrder', () => {
    const pendingOrder = () => ({
      id: 10,
      status: Status.Processed,
      paymentMethod: PaymentMethod.Card,
      paymentStatus: PaymentStatus.Pending,
      paymentInvoiceId: 'invoice-1',
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ],
    });

    const build = (order: ReturnType<typeof pendingOrder> | null) => {
      const lockedOrder = order ? { ...order } : null;
      const mockManager = {
        findOne: jest.fn().mockImplementation((entity, options) => {
          if (entity === OrderEntity || (entity && entity.name === 'OrderEntity')) {
            return Promise.resolve(lockedOrder);
          }
          return Promise.resolve({ id: options.where.id, count: 5, status: 'active' });
        }),
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ ...data })),
      };
      const service = new OrderService({} as any, {} as any, {} as any);
      return { service, mockManager, lockedOrder };
    };

    it('cancels a pending order, marks payment FAILED and returns stock', async () => {
      const { service, mockManager, lockedOrder } = build(pendingOrder());

      const result = await service.cancelUnpaidOrder(mockManager as any, 10, 'invoice-1');

      expect(result).toEqual(
        expect.objectContaining({
          status: Status.Canceled,
          paymentStatus: PaymentStatus.Failed,
        }),
      );
      expect(lockedOrder.paymentStatus).toBe(PaymentStatus.Failed);
      const productSaves = mockManager.save.mock.calls.filter(
        ([entity]: [unknown]) => entity === ProductEntity,
      );
      expect(productSaves).toHaveLength(2);
      const product1 = productSaves.find(([, data]: [unknown, any]) => data.id === 1);
      const product2 = productSaves.find(([, data]: [unknown, any]) => data.id === 2);
      expect(product1[1].count).toBe(7);
      expect(product2[1].count).toBe(6);
    });

    it('does not touch an order already PAID by a webhook', async () => {
      const { service, mockManager } = build({
        ...pendingOrder(),
        paymentStatus: PaymentStatus.Paid,
      });

      const result = await service.cancelUnpaidOrder(mockManager as any, 10, 'invoice-1');

      expect(result).toBeNull();
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('does not cancel an order that moved to a newer invoice', async () => {
      const { service, mockManager } = build(pendingOrder());

      const result = await service.cancelUnpaidOrder(mockManager as any, 10, 'old-invoice');

      expect(result).toBeNull();
      expect(mockManager.save).not.toHaveBeenCalled();
    });
  });

  describe('cancelOrderWithoutInvoice', () => {
    const pendingOrderNoInvoice = () => ({
      id: 10,
      status: Status.Processed,
      paymentMethod: PaymentMethod.Card,
      paymentStatus: PaymentStatus.NotRequired,
      paymentInvoiceId: null,
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ],
    });

    const build = (order: ReturnType<typeof pendingOrderNoInvoice> | null) => {
      const lockedOrder = order ? { ...order } : null;
      const mockManager = {
        findOne: jest.fn().mockImplementation((entity, options) => {
          if (entity === OrderEntity || (entity && entity.name === 'OrderEntity')) {
            return Promise.resolve(lockedOrder);
          }
          return Promise.resolve({ id: options.where.id, count: 5, status: 'active' });
        }),
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ ...data })),
      };
      const service = new OrderService({} as any, {} as any, {} as any);
      return { service, mockManager, lockedOrder };
    };

    it('cancels a CARD order without invoice, marks payment FAILED and returns stock', async () => {
      const { service, mockManager, lockedOrder } = build(pendingOrderNoInvoice());

      const result = await service.cancelOrderWithoutInvoice(mockManager as any, 10);

      expect(result).toEqual(
        expect.objectContaining({
          status: Status.Canceled,
          paymentStatus: PaymentStatus.Failed,
        }),
      );
      expect(lockedOrder.paymentStatus).toBe(PaymentStatus.Failed);
      const productSaves = mockManager.save.mock.calls.filter(
        ([entity]: [unknown]) => entity === ProductEntity,
      );
      expect(productSaves).toHaveLength(2);
      const product1 = productSaves.find(([, data]: [unknown, any]) => data.id === 1);
      const product2 = productSaves.find(([, data]: [unknown, any]) => data.id === 2);
      expect(product1[1].count).toBe(7);
      expect(product2[1].count).toBe(6);
    });

    it('does not touch an order with paymentMethod COD', async () => {
      const { service, mockManager } = build({
        ...pendingOrderNoInvoice(),
        paymentMethod: PaymentMethod.Cod,
      });

      const result = await service.cancelOrderWithoutInvoice(mockManager as any, 10);

      expect(result).toBeNull();
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('does not touch an order that already has paymentInvoiceId', async () => {
      const { service, mockManager } = build({
        ...pendingOrderNoInvoice(),
        paymentInvoiceId: 'invoice-123',
      });

      const result = await service.cancelOrderWithoutInvoice(mockManager as any, 10);

      expect(result).toBeNull();
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('does not touch an order with paymentStatus other than NOT_REQUIRED', async () => {
      const { service, mockManager } = build({
        ...pendingOrderNoInvoice(),
        paymentStatus: PaymentStatus.Pending,
      });

      const result = await service.cancelOrderWithoutInvoice(mockManager as any, 10);

      expect(result).toBeNull();
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('does not touch an already canceled order', async () => {
      const { service, mockManager } = build({
        ...pendingOrderNoInvoice(),
        status: Status.Canceled,
      });

      const result = await service.cancelOrderWithoutInvoice(mockManager as any, 10);

      expect(result).toBeNull();
      expect(mockManager.save).not.toHaveBeenCalled();
    });
  });

  describe('cancelFailedOrder', () => {
    const failedOrder = () => ({
      id: 10,
      status: Status.Processed,
      paymentMethod: PaymentMethod.Card,
      paymentStatus: PaymentStatus.Failed,
      paymentInvoiceId: 'failed-invoice',
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ],
    });

    const build = (order: ReturnType<typeof failedOrder> | null) => {
      const lockedOrder = order ? { ...order } : null;
      const mockManager = {
        findOne: jest.fn().mockImplementation((entity, options) => {
          if (entity === OrderEntity) {
            return Promise.resolve(lockedOrder);
          }
          return Promise.resolve({ id: options.where.id, count: 5, status: 'active' });
        }),
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ ...data })),
      };
      const service = new OrderService({} as any, {} as any, {} as any);
      return { service, mockManager };
    };

    it('cancels a FAILED order, keeps payment FAILED and returns stock', async () => {
      const { service, mockManager } = build(failedOrder());

      const result = await service.cancelFailedOrder(mockManager as any, 10, 'failed-invoice');

      expect(result).toEqual(
        expect.objectContaining({
          status: Status.Canceled,
          paymentStatus: PaymentStatus.Failed,
        }),
      );
      expect(mockManager.findOne).toHaveBeenCalledWith(OrderEntity, {
        where: { id: 10 },
        lock: { mode: 'pessimistic_write' },
      });
      const productSaves = mockManager.save.mock.calls.filter(
        ([entity]: [unknown]) => entity === ProductEntity,
      );
      expect(productSaves).toHaveLength(2);
      expect(productSaves.find(([, data]: [unknown, any]) => data.id === 1)[1].count).toBe(7);
      expect(productSaves.find(([, data]: [unknown, any]) => data.id === 2)[1].count).toBe(6);
    });

    it('does not touch an order that moved to a new PENDING invoice', async () => {
      const { service, mockManager } = build({
        ...failedOrder(),
        paymentStatus: PaymentStatus.Pending,
        paymentInvoiceId: 'new-invoice',
      });

      const result = await service.cancelFailedOrder(mockManager as any, 10, 'failed-invoice');

      expect(result).toBeNull();
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('does not touch a paid order', async () => {
      const { service, mockManager } = build({
        ...failedOrder(),
        paymentStatus: PaymentStatus.Paid,
      });

      const result = await service.cancelFailedOrder(mockManager as any, 10, 'failed-invoice');

      expect(result).toBeNull();
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('does not touch an already canceled order', async () => {
      const { service, mockManager } = build({
        ...failedOrder(),
        status: Status.Canceled,
      });

      const result = await service.cancelFailedOrder(mockManager as any, 10, 'failed-invoice');

      expect(result).toBeNull();
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('does not touch an order the admin already moved past processing', async () => {
      const { service, mockManager } = build({
        ...failedOrder(),
        status: Status.Sent,
      });

      const result = await service.cancelFailedOrder(mockManager as any, 10, 'failed-invoice');

      expect(result).toBeNull();
      expect(mockManager.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes an existing order', async () => {
      const mockManager = {
        save: jest.fn(),
        findOne: jest.fn().mockImplementation((entity, options) => {
          if (entity === OrderEntity || (entity && entity.name === 'OrderEntity')) {
            return Promise.resolve({ id: options.where.id, items: [], status: Status.Processed });
          }
          return Promise.resolve({ id: options.where.id, count: 10, status: 'active' });
        }),
        transaction: jest.fn().mockImplementation(async (callback) => callback(mockManager)),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          status: Status.Processed,
          items: [],
        }),
        delete: jest.fn(),
        manager: mockManager,
      };
      const service = new OrderService(repository as any, {} as any, {} as any);

      await expect(service.remove(10)).resolves.toBe('Замовлення було успішно видалено');
      expect(mockManager.delete).toHaveBeenCalledWith(OrderEntity, 10);
    });

    it('throws NotFound for a missing order', async () => {
      const mockManager = {
        save: jest.fn(),
        findOne: jest.fn().mockResolvedValue(null),
        transaction: jest.fn().mockImplementation(async (callback) => callback(mockManager)),
        delete: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue(null),
        delete: jest.fn(),
        manager: mockManager,
      };
      const service = new OrderService(repository as any, {} as any, {} as any);

      await expect(service.remove(99)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('restores stock before deleting the order', async () => {
      const mockManager = {
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ ...data })),
        findOne: jest.fn().mockImplementation((entity, options) => {
          if (entity === OrderEntity || (entity && entity.name === 'OrderEntity')) {
            return Promise.resolve({ id: options.where.id, items: [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 3 }], status: Status.Processed });
          }
          if (entity === ProductEntity || (entity && entity.name === 'ProductEntity')) {
            return Promise.resolve({ id: options.where.id, count: 3, status: 'active' });
          }
          return Promise.resolve({ id: options.where.id, items: [], user: { id: 3 } });
        }),
        transaction: jest.fn().mockImplementation(async (callback) => callback(mockManager)),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          status: Status.Processed,
          items: [
            { productId: 1, quantity: 2 },
            { productId: 2, quantity: 3 },
          ],
        }),
        delete: jest.fn(),
        manager: mockManager,
      };
      const service = new OrderService(repository as any, {} as any, {} as any);

      await service.remove(10);

      expect(mockManager.transaction).toHaveBeenCalled();
      expect(mockManager.delete).toHaveBeenCalledWith(OrderEntity, 10);
      // Check that product counts were incremented
      const productSaves = mockManager.save.mock.calls.filter(
        call => call[0] === ProductEntity || (call[0] && call[0].name === 'ProductEntity')
      );
      expect(productSaves.length).toBe(2);
      // Product 1: count was 3, ordered 2 -> should be 5
      const product1Save = productSaves.find(call => call[1].id === 1);
      expect(product1Save).toBeDefined();
      expect(product1Save[1].count).toBe(5);
      // Product 2: count was 3, ordered 3 -> should be 6
      const product2Save = productSaves.find(call => call[1].id === 2);
      expect(product2Save).toBeDefined();
      expect(product2Save[1].count).toBe(6);
    });

    it('does not restore stock when removing an already cancelled order', async () => {
      const mockManager = {
        save: jest.fn(),
        findOne: jest.fn().mockImplementation((entity, options) => {
          if (entity === OrderEntity || (entity && entity.name === 'OrderEntity')) {
            return Promise.resolve({ id: options.where.id, items: [{ productId: 1, quantity: 2 }], status: Status.Canceled });
          }
          return Promise.resolve({ id: options.where.id, count: 3, status: 'active' });
        }),
        transaction: jest.fn().mockImplementation(async (callback) => callback(mockManager)),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          status: Status.Canceled,
          items: [{ productId: 1, quantity: 2 }],
        }),
        delete: jest.fn(),
        manager: mockManager,
      };
      const service = new OrderService(repository as any, {} as any, {} as any);

      await service.remove(10);

      expect(mockManager.transaction).toHaveBeenCalled();
      const productSaves = mockManager.save.mock.calls.filter(
        call => call[0] === ProductEntity || (call[0] && call[0].name === 'ProductEntity')
      );
      expect(productSaves.length).toBe(0);
    });

    it('throws NotFound when order not found during remove', async () => {
      const mockManager = {
        save: jest.fn(),
        findOne: jest.fn(),
        transaction: jest.fn().mockImplementation(async (callback) => callback(mockManager)),
        delete: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue(null),
        delete: jest.fn(),
        manager: mockManager,
      };
      const service = new OrderService(repository as any, {} as any, {} as any);

      await expect(service.remove(99)).rejects.toBeInstanceOf(NotFoundException);
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

  describe('Ukrposhta index validation', () => {
    const makeService = (order: Partial<OrderEntity>) => {
      const mockManager = {
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve({ ...data })),
        findOne: jest.fn().mockResolvedValue({ ...order, items: [] }),
        transaction: jest.fn().mockImplementation(async (callback) => callback(mockManager)),
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue({ ...order }),
        save: jest.fn(saved => Promise.resolve(saved)),
        manager: mockManager,
      };
      const service = new OrderService(repository as any, {} as any, {} as any);
      return { service, repository, mockManager };
    };
    const legacyUkrposhtaOrder = {
      id: 16,
      status: Status.Processed,
      deliveryMethod: DeliveryMethod.Ukrposhta,
      department: 'Відділення №5',
    };

    it('rejects changing only department of a Ukrposhta order to a non-index', async () => {
      const { service, repository } = makeService({ ...legacyUkrposhtaOrder, department: '79000' });

      await expect(service.update({ id: 16, department: 'Відділення №5' })).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects switching deliveryMethod to Ukrposhta when the stored department is not an index', async () => {
      const { service, repository } = makeService({
        id: 15,
        status: Status.Processed,
        deliveryMethod: DeliveryMethod.Meest,
        department: 'Відділення 1',
      });

      await expect(service.update({ id: 15, deliveryMethod: DeliveryMethod.Ukrposhta })).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('allows a valid 5-digit index for a Ukrposhta order', async () => {
      const { service } = makeService({ ...legacyUkrposhtaOrder, department: '11111' });

      await expect(service.update({ id: 16, department: '79000' })).resolves.toMatchObject({ department: '79000' });
    });

    it('allows switching to Ukrposhta together with a valid index', async () => {
      const { service } = makeService({ id: 15, deliveryMethod: DeliveryMethod.Meest, department: 'Відділення 1' });

      await expect(
        service.update({ id: 15, deliveryMethod: DeliveryMethod.Ukrposhta, department: '79000' }),
      ).resolves.toMatchObject({ deliveryMethod: DeliveryMethod.Ukrposhta, department: '79000' });
    });

    it('allows any department name for other delivery methods', async () => {
      const { service } = makeService({ id: 18, deliveryMethod: DeliveryMethod.Meest, department: 'Відділення 1' });

      await expect(service.update({ id: 18, department: 'Відділення 2' })).resolves.toMatchObject({ department: 'Відділення 2' });
    });

    it('allows changing only the comment of a legacy Ukrposhta order', async () => {
      const { service } = makeService(legacyUkrposhtaOrder);

      await expect(service.update({ id: 16, comment: 'Подзвоніть' })).resolves.toMatchObject({
        comment: 'Подзвоніть',
        department: 'Відділення №5',
      });
    });

    it('allows changing the status of a legacy Ukrposhta order', async () => {
      const { service, mockManager } = makeService(legacyUkrposhtaOrder);

      await expect(service.updateStatus(16, Status.Sent)).resolves.toMatchObject({
        status: Status.Sent,
        department: 'Відділення №5',
      });
      expect(mockManager.save).toHaveBeenCalled();
    });

    it('rejects a status change together with an invalid Ukrposhta department', async () => {
      const { service, mockManager } = makeService({ ...legacyUkrposhtaOrder, department: '79000' });

      await expect(
        service.update({ id: 16, status: Status.Sent, department: 'Відділення №5' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockManager.save).not.toHaveBeenCalled();
    });
  });
});
