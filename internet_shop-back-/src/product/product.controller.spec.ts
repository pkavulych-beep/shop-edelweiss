import { BadRequestException } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';

describe('ProductController.create', () => {
  const productService = { create: jest.fn() };
  const controller = new ProductController(productService as unknown as ProductService);
  const dto = { name: 'Test' } as CreateProductDto;

  beforeEach(() => productService.create.mockReset());

  it.each([
    ['files is undefined', undefined],
    ['photos field is missing', {}],
    ['photos list is empty', { photos: [] }],
  ])('throws 400 when %s', (_, files) => {
    expect(() => controller.create(files, dto)).toThrow(BadRequestException);
    expect(productService.create).not.toHaveBeenCalled();
  });

  it('passes photos to the service', () => {
    const photos = [{ originalname: 'a.jpg' }];
    controller.create({ photos }, dto);
    expect(productService.create).toHaveBeenCalledWith(dto, photos);
  });
});
