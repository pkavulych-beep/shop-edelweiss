import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './user.service';
import { verifyPassword } from '../auth/password';

describe('UsersService cart', () => {
  let basketRepository;
  let productService;
  let service: UsersService;

  beforeEach(() => {
    basketRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn(item => item),
      save: jest.fn(item => Promise.resolve(item)),
      delete: jest.fn(),
    };
    productService = {
      assertPurchasable: jest.fn(),
      findPurchasable: jest.fn(),
      findProductsMain: jest.fn().mockResolvedValue([{ id: 5, sizes: ['M'] }]),
    };
    service = new UsersService({} as any, basketRepository, {} as any, productService);
  });

  it('does not add a hidden product to the basket', async () => {
    productService.assertPurchasable.mockRejectedValue(new NotFoundException());

    await expect(
      service.addProductToBasket(1, { idProduct: 5, size: 'M' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(basketRepository.save).not.toHaveBeenCalled();
  });

  it('adds a visible product to the basket', async () => {
    await service.addProductToBasket(1, { idProduct: 5, size: 'M' });

    expect(productService.assertPurchasable).toHaveBeenCalledWith([5]);
    expect(basketRepository.save).toHaveBeenCalledWith({
      userId: 1,
      productId: 5,
      size: 'M',
      quantity: 1,
    });
  });


  it('adds a product without sizes to basket even if size not provided', async () => {
    productService.findProductsMain.mockResolvedValueOnce([{ id: 5, sizes: [] }]);
    await service.addProductToBasket(1, { idProduct: 5 });
    expect(basketRepository.save).toHaveBeenCalledWith({
      userId: 1,
      productId: 5,
      size: '',
      quantity: 1,
    });
  });

  it('adds a product without sizes to basket if empty string size provided', async () => {
    productService.findProductsMain.mockResolvedValueOnce([{ id: 5, sizes: [] }]);
    await service.addProductToBasket(1, { idProduct: 5, size: '' as any });
    expect(basketRepository.save).toHaveBeenCalledWith({
      userId: 1,
      productId: 5,
      size: '',
      quantity: 1,
    });
  });

  it('throws BadRequest if product has sizes but size not provided', async () => {
    productService.findProductsMain.mockResolvedValueOnce([{ id: 5, sizes: ['M'] }]);
    await expect(
      service.addProductToBasket(1, { idProduct: 5 } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(basketRepository.save).not.toHaveBeenCalled();
  });

  it('throws BadRequest if product has sizes but size is invalid', async () => {
    productService.findProductsMain.mockResolvedValueOnce([{ id: 5, sizes: ['M'] }]);
    await expect(
      service.addProductToBasket(1, { idProduct: 5, size: 'XXL' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(basketRepository.save).not.toHaveBeenCalled();
  });
  it('rejects adding more than the stock of the size', async () => {
    productService.findProductsMain.mockResolvedValueOnce([
      { id: 5, sizes: ['S', 'M'], sizeStock: { S: 2, M: 0 }, count: 2 },
    ]);
    basketRepository.findOne.mockResolvedValueOnce({ userId: 1, productId: 5, size: 'S', quantity: 2 });

    await expect(
      service.addProductToBasket(1, { idProduct: 5, size: 'S' }),
    ).rejects.toThrow('Недостатньо товару на складі. Доступно: 2');
    expect(basketRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a size that is out of stock', async () => {
    productService.findProductsMain.mockResolvedValueOnce([
      { id: 5, sizes: ['S', 'M'], sizeStock: { S: 2, M: 0 }, count: 2 },
    ]);

    await expect(
      service.addProductToBasket(1, { idProduct: 5, size: 'M' }),
    ).rejects.toThrow('Доступно: 0');
  });

  it('adds while the stock of the size allows it', async () => {
    productService.findProductsMain.mockResolvedValueOnce([
      { id: 5, sizes: ['S', 'M'], sizeStock: { S: 2, M: 0 }, count: 2 },
    ]);
    basketRepository.findOne.mockResolvedValueOnce({ userId: 1, productId: 5, size: 'S', quantity: 1 });

    await service.addProductToBasket(1, { idProduct: 5, size: 'S' });
    expect(basketRepository.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 2 }));
  });

  it('limits a product without sizes by its count', async () => {
    productService.findProductsMain.mockResolvedValueOnce([{ id: 5, sizes: [], sizeStock: null, count: 1 }]);
    basketRepository.findOne.mockResolvedValueOnce({ userId: 1, productId: 5, size: '', quantity: 1 });

    await expect(service.addProductToBasket(1, { idProduct: 5 })).rejects.toThrow('Доступно: 1');
  });

  it('trims guest cart quantities to the stock of the size', async () => {
    productService.findPurchasable.mockResolvedValue([
      { id: 1, sizes: ['S', 'M'], sizeStock: { S: 3, M: 0 }, count: 3 },
    ]);
    basketRepository.findOne
      .mockResolvedValueOnce({ userId: 7, productId: 1, size: 'S', quantity: 2 })
      .mockResolvedValueOnce(null);

    await service.syncCart(7, [
      { productId: 1, size: 'S', quantity: 5 },
      { productId: 1, size: 'M', quantity: 1 },
    ]);

    expect(basketRepository.save).toHaveBeenCalledTimes(1);
    expect(basketRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ size: 'S', quantity: 3 }),
    );
  });

  it('removes a basket item whose size sold out when syncing a guest cart', async () => {
    productService.findPurchasable.mockResolvedValue([
      { id: 1, sizes: ['S', 'M'], sizeStock: { S: 3, M: 0 }, count: 3 },
    ]);
    basketRepository.findOne.mockResolvedValueOnce({ id: 9, userId: 7, productId: 1, size: 'M', quantity: 1 });

    await service.syncCart(7, [{ productId: 1, size: 'M', quantity: 1 }]);

    expect(basketRepository.delete).toHaveBeenCalledWith({ id: 9 });
    expect(basketRepository.save).not.toHaveBeenCalled();
  });

  it('skips hidden products when syncing a guest cart', async () => {
    productService.findPurchasable.mockResolvedValue([{ id: 1, sizes: ['M'], count: null }]);

    await service.syncCart(7, [
      { productId: 1, size: 'M', quantity: 2 },
      { productId: 5, size: 'L', quantity: 1 },
    ]);

    expect(productService.findPurchasable).toHaveBeenCalledWith([1, 5]);
    expect(basketRepository.save).toHaveBeenCalledTimes(1);
    expect(basketRepository.save).toHaveBeenCalledWith({
      userId: 7,
      productId: 1,
      size: 'M',
      quantity: 2,
    });
  });
});

describe('UsersService passwords', () => {
  let repository;
  let service: UsersService;

  beforeEach(() => {
    repository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((user) => user),
      save: jest.fn((user) => Promise.resolve(user)),
      update: jest.fn(),
    };
    const rolesService = {
      getRoleByValue: jest.fn().mockResolvedValue({ value: 'USER' }),
    };
    service = new UsersService(repository, {} as any, rolesService as any, {} as any);
  });

  it('hashes the password on registration', async () => {
    const user = await service.create({
      fullName: 'Тест Тестович',
      phoneNumber: '380991112233',
      password: 'secret123',
    });

    expect(user.password).not.toBe('secret123');
    await expect(verifyPassword('secret123', user.password)).resolves.toBe(true);
  });
  it('rejects registration if email differs only by case', async () => {
    const repository = {
      findOne: jest.fn((options: any) => {
        if (options?.where?.some((w: any) => w.email === 'test@example.com')) {
          return { id: 1, phoneNumber: 'other', email: 'test@example.com' };
        }
        return null;
      }),
      create: jest.fn((user) => user),
      save: jest.fn((user) => Promise.resolve(user)),
    };
    const rolesService = {
      getRoleByValue: jest.fn().mockResolvedValue({ value: 'USER' }),
    };
    const service = new UsersService(repository as any, {} as any, rolesService as any, {} as any);

    await expect(
      service.create({
        fullName: 'Тест',
        phoneNumber: '380991112233',
        password: 'secret123',
        email: 'TEST@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: [{ phoneNumber: '380991112233' }, { email: 'test@example.com' }],
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('normalizes email on update and does not pass empty email to changes', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    };
    const service = new UsersService(repository as any, {} as any, {} as any, {} as any);
    (service as any).findById = jest.fn().mockResolvedValue({ id: 3 });

    await service.update(3, {
      fullName: 'Тест Тестович',
      phoneNumber: '380991112233',
      email: ' Test@Example.com ',
    } as any);

    expect(repository.findOne).toHaveBeenCalledWith({ where: { phoneNumber: '380991112233' } });
    expect(repository.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
    const [id, changes] = repository.update.mock.calls[0];
    expect(id).toBe(3);
    expect(changes.email).toBe('test@example.com');
  });

  it('does not include email in changes when normalized to undefined', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    };
    const service = new UsersService(repository as any, {} as any, {} as any, {} as any);
    (service as any).findById = jest.fn().mockResolvedValue({ id: 3 });

    await service.update(3, {
      fullName: 'Тест Тестович',
      phoneNumber: '380991112233',
      email: '   ',
    } as any);

    const [id, changes] = repository.update.mock.calls[0];
    expect(id).toBe(3);
    expect(changes.email).toBeUndefined();
  });


  it('rejects an update that uses another user’s phone number', async () => {
    repository.findOne.mockResolvedValueOnce({ id: 4 });

    await expect(
      service.update(3, {
        fullName: 'Тест Тестович',
        phoneNumber: '380991112233',
        email: undefined,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects an update that uses another user’s email', async () => {
    repository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 4 });

    await expect(
      service.update(3, {
        fullName: 'Тест Тестович',
        phoneNumber: '380991112233',
        email: 'taken@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('returns the complete profile after an update', async () => {
    const profile = {
      id: 3,
      roles: [{ value: 'USER' }],
      cartItems: [],
    };
    repository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(profile);

    await expect(
      service.update(3, {
        fullName: 'Тест Тестович',
        phoneNumber: '380991112233',
        email: undefined,
      }),
    ).resolves.toBe(profile);
    expect(repository.findOne).toHaveBeenLastCalledWith({
      where: { id: 3 },
      relations: ['roles', 'cartItems', 'cartItems.product'],
    });
  });
});

describe('UsersService.findForAuth', () => {
  let repository;
  let service: UsersService;

  beforeEach(() => {
    repository = {
      findOne: jest.fn().mockResolvedValue({
        id: 3,
        roles: [{ value: 'USER' }],
      }),
    };
    service = new UsersService(repository, {} as any, {} as any, {} as any);
  });

  it('reads the user with roles only, without the cart', async () => {
    await expect(service.findForAuth(3)).resolves.toEqual({
      id: 3,
      roles: [{ value: 'USER' }],
    });
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 3 },
      relations: ['roles'],
    });
  });
});
