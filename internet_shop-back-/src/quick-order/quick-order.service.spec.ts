import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuickOrderService } from './quick-order.service';

describe('QuickOrderService', () => {
  const product = { id: 7, name: 'Сукня', sizes: ['S', 'M'] };
  let repository;
  let productService;
  let service: QuickOrderService;

  beforeEach(() => {
    repository = {
      save: jest.fn(entity => Promise.resolve({ id: 1, createdAt: new Date(0), ...entity })),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    productService = {
      assertPurchasable: jest.fn().mockResolvedValue(undefined),
      findProductsMain: jest.fn().mockResolvedValue([product]),
    };
    service = new QuickOrderService(repository, productService);
  });

  describe('create', () => {
    const dto = { phoneNumber: '380991234567', productId: 7, size: 'M' };

    it('saves phone, product and size and returns only id and date', async () => {
      await expect(service.create(dto)).resolves.toEqual({ id: 1, createdAt: new Date(0) });
      expect(productService.assertPurchasable).toHaveBeenCalledWith([7]);
      expect(repository.save).toHaveBeenCalledWith({
        phoneNumber: '380991234567',
        product,
        size: 'M',
      });
    });

    it('normalizes phone before saving (raw formats → 380XXXXXXXXX)', async () => {
      const rawDtos = [
        { phoneNumber: '+38 (099) 123-45-67', expected: '380991234567' },
        { phoneNumber: '+380991234567', expected: '380991234567' },
        { phoneNumber: '099 123 45 67', expected: '380991234567' },
        { phoneNumber: '991234567', expected: '380991234567' },
      ];
      for (const { phoneNumber, expected } of rawDtos) {
        jest.clearAllMocks();
        await service.create({ ...dto, phoneNumber });
        expect(repository.save).toHaveBeenCalledWith(
          expect.objectContaining({ phoneNumber: expected }),
        );
      }
    });

    it('does not save a request for a hidden or missing product', async () => {
      productService.assertPurchasable.mockRejectedValue(new NotFoundException());

      await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it.each([
      ['without size', undefined],
      ['with a size the product does not have', 'XXL'],
    ])('rejects a request %s', async (_name, size) => {
      await expect(service.create({ ...dto, size })).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('accepts a request without size for a product without sizes', async () => {
      productService.findProductsMain.mockResolvedValue([{ ...product, sizes: [] }]);

      await service.create({ ...dto, size: undefined });
      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ size: null }));
    });
  });

  it('lists requests with products, newest first', async () => {
    await service.findAll();
    expect(repository.find).toHaveBeenCalledWith({
      relations: ['product'],
      order: { createdAt: 'DESC' },
    });
  });

  describe('remove', () => {
    it('deletes the request', async () => {
      await service.remove(1);
      expect(repository.delete).toHaveBeenCalledWith(1);
    });

    it('throws 404 for a missing request', async () => {
      repository.delete.mockResolvedValue({ affected: 0 });
      await expect(service.remove(1)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
