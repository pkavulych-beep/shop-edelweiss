import { NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { ProductService } from './product.service';
import { ProductStatus } from './entities/product.entity';

describe('ProductService', () => {
  let repository;
  let basketRepository;
  let fileService;
  let photosService;
  let service: ProductService;
  let ordersCount: number;

  beforeEach(() => {
    ordersCount = 0;
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn(() => Promise.resolve(ordersCount)),
    };
    repository = {
      findOne: jest.fn(),
      find: jest.fn(),
      findBy: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    basketRepository = { delete: jest.fn() };
    fileService = { deleteFile: jest.fn() };
    photosService = { remove: jest.fn() };
    service = new ProductService(repository, basketRepository, fileService, photosService);
  });

  describe('remove', () => {
    beforeEach(() => {
      repository.findOne.mockResolvedValue({
        id: 5,
        cover: 'cover.jpg',
        photos: [{ id: 1, url: 'photo.jpg' }],
      });
    });

    it('hides a product that is in orders instead of deleting it', async () => {
      ordersCount = 2;

      await service.remove(5);

      expect(basketRepository.delete).toHaveBeenCalledWith({ productId: 5 });
      expect(repository.update).toHaveBeenCalledWith(5, {
        status: ProductStatus.Hidden,
      });
      expect(fileService.deleteFile).not.toHaveBeenCalled();
      expect(photosService.remove).not.toHaveBeenCalled();
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('deletes a product that is not in any order', async () => {
      ordersCount = 0;

      await service.remove(5);

      expect(basketRepository.delete).toHaveBeenCalledWith({ productId: 5 });
      expect(fileService.deleteFile).toHaveBeenCalledTimes(2);
      expect(photosService.remove).toHaveBeenCalledWith(1);
      expect(repository.delete).toHaveBeenCalledWith(5);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('throws 404 for a missing product', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.remove(5)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findDiscounts', () => {
    it.each([['man'], [undefined]])('filters out hidden products (gender: %s)', async gender => {
      await service.findDiscounts(gender);

      const where = repository.findBy.mock.calls[0][0];
      expect(where.status).toBeInstanceOf(FindOperator);
      expect(where.status.type).toBe('or');
    });
  });

  describe('findOne', () => {
    it('returns a visible product', async () => {
      const product = { id: 1, status: ProductStatus.Active };
      repository.findOne.mockResolvedValue(product);

      await expect(service.findOne(1)).resolves.toBe(product);
    });

    it('throws 404 for a hidden product', async () => {
      repository.findOne.mockResolvedValue({
        id: 1,
        status: ProductStatus.Hidden,
      });

      await expect(service.findOne(1)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('assertPurchasable', () => {
    it('passes when every product is purchasable', async () => {
      repository.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      await expect(service.assertPurchasable([1, 2])).resolves.toBeUndefined();
      expect(repository.find.mock.calls[0][0].where.status).toBeInstanceOf(FindOperator);
    });

    it('throws 404 when a product is hidden or missing', async () => {
      repository.find.mockResolvedValue([{ id: 1 }]);

      await expect(service.assertPurchasable([1, 2])).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
