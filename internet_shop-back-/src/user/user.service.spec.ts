import { NotFoundException } from '@nestjs/common';
import { UsersService } from './user.service';

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
    };
    service = new UsersService({} as any, basketRepository, {} as any, productService);
  });

  it('does not add a hidden product to the basket', async () => {
    productService.assertPurchasable.mockRejectedValue(new NotFoundException());

    await expect(
      service.addProductToBasket({ idUser: 1, idProduct: 5, size: 'M' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(basketRepository.save).not.toHaveBeenCalled();
  });

  it('adds a visible product to the basket', async () => {
    await service.addProductToBasket({ idUser: 1, idProduct: 5, size: 'M' });

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
