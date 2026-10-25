import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuickOrderService } from './quick-order.service';
import { ProductStatus } from '../product/entities/product.entity';

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
      findByIdWithStock: jest.fn().mockResolvedValue({ id: 7, count: 10, status: ProductStatus.Active, sizes: ['S', 'M'] }),
      findProductsMain: jest.fn().mockResolvedValue([product]),
    };
    service = new QuickOrderService(repository, productService);
  });

  describe('create', () => {
    const dto = { phoneNumber: '380991234567', productId: 7, size: 'M' };
    const fullProduct = { id: 7, name: 'Сукня', sizes: ['S', 'M'], price: 100, cover: '', salePrice: null };

    it('saves phone, product and size and returns only id and date', async () => {
      productService.findProductsMain.mockResolvedValue([fullProduct]);
      await expect(service.create(dto)).resolves.toEqual({ id: 1, createdAt: new Date(0) });
      expect(productService.findByIdWithStock).toHaveBeenCalledWith(7);
      expect(repository.save).toHaveBeenCalledWith({
        phoneNumber: '380991234567',
        product: fullProduct,
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
        productService.findByIdWithStock.mockResolvedValue({ id: 7, count: 10, status: ProductStatus.Active, sizes: ['S', 'M'] });
        productService.findProductsMain.mockResolvedValue([fullProduct]);
        await service.create({ ...dto, phoneNumber });
        expect(repository.save).toHaveBeenCalledWith(
          expect.objectContaining({ phoneNumber: expected }),
        );
      }
    });

    it('throws 404 for a missing product', async () => {
      productService.findByIdWithStock.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('throws 404 for a hidden product', async () => {
      productService.findByIdWithStock.mockResolvedValue({ id: 7, count: 10, status: ProductStatus.Hidden, sizes: ['S', 'M'] });

      await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('throws 400 when product exists but count is 0', async () => {
      productService.findByIdWithStock.mockResolvedValue({ id: 7, count: 0, status: ProductStatus.Active, sizes: ['S', 'M'] });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow('Товару немає в наявності');
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('allows purchase when count is null (no stock tracking)', async () => {
      productService.findByIdWithStock.mockResolvedValue({ id: 7, count: null, status: ProductStatus.Active, sizes: ['S', 'M'] });

      await expect(service.create(dto)).resolves.toEqual({ id: 1, createdAt: new Date(0) });
      expect(repository.save).toHaveBeenCalled();
    });

    it.each([
      ['without size', undefined],
      ['with a size the product does not have', 'XXL'],
    ])('rejects a request %s', async (_name, size) => {
      await expect(service.create({ ...dto, size })).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects a size that is out of stock', async () => {
      const sizeStock = { S: 2, M: 0 };
      productService.findByIdWithStock.mockResolvedValue({
        ...product,
        sizeStock,
        count: 2,
        status: ProductStatus.Active,
      });
      productService.findProductsMain.mockResolvedValue([
        { ...product, sizeStock, count: 2 },
      ]);

      await expect(service.create(dto)).rejects.toThrow('Розміру M немає в наявності');
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('accepts a size that is in stock', async () => {
      const sizeStock = { S: 0, M: 1 };
      productService.findByIdWithStock.mockResolvedValue({
        ...product,
        sizeStock,
        count: 1,
        status: ProductStatus.Active,
      });
      productService.findProductsMain.mockResolvedValue([
        { ...product, sizeStock, count: 1 },
      ]);

      await service.create(dto);
      expect(repository.save).toHaveBeenCalled();
    });

    it('accepts a request without size for a product without sizes', async () => {
      productService.findByIdWithStock.mockResolvedValue({ id: 7, count: 10, status: ProductStatus.Active, sizes: [] });
      productService.findProductsMain.mockResolvedValue([{ ...fullProduct, sizes: [] }]);

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
