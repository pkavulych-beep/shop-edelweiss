import { ConflictException, NotFoundException } from '@nestjs/common';
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
    };
    productService = {
      assertPurchasable: jest.fn(),
      findPurchasableIds: jest.fn(),
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

  it('skips hidden products when syncing a guest cart', async () => {
    productService.findPurchasableIds.mockResolvedValue([1]);

    await service.syncCart(7, [
      { productId: 1, size: 'M', quantity: 2 },
      { productId: 5, size: 'L', quantity: 1 },
    ]);

    expect(productService.findPurchasableIds).toHaveBeenCalledWith([1, 5]);
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

  it('hashes a new password on update', async () => {
    await service.update(3, {
      fullName: 'Тест Тестович',
      phoneNumber: '380991112233',
      email: undefined,
      password: 'newpass123',
    });

    const [id, changes] = repository.update.mock.calls[0];
    expect(id).toBe(3);
    await expect(verifyPassword('newpass123', changes.password)).resolves.toBe(true);
  });

  it('leaves the password alone when the update does not change it', async () => {
    await service.update(3, {
      fullName: 'Тест Тестович',
      phoneNumber: '380991112233',
      email: undefined,
      password: undefined,
    });

    expect(repository.update.mock.calls[0][1].password).toBeUndefined();
  });

  it('rejects an update that uses another user’s phone number', async () => {
    repository.findOne.mockResolvedValueOnce({ id: 4 });

    await expect(
      service.update(3, {
        fullName: 'Тест Тестович',
        phoneNumber: '380991112233',
        email: undefined,
        password: undefined,
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
        password: undefined,
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
        password: undefined,
      }),
    ).resolves.toBe(profile);
    expect(repository.findOne).toHaveBeenLastCalledWith({
      where: { id: 3 },
      relations: ['roles', 'cartItems', 'cartItems.product'],
    });
  });
});
