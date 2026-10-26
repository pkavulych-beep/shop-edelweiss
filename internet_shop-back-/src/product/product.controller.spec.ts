import { BadRequestException } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { IMAGE_FORMAT_ERROR, IMAGE_SIZE_ERROR, MAX_IMAGE_SIZE_BYTES } from 'src/file/image';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const photo = (buffer: Buffer, mimetype: string, originalname: string) => ({
  buffer,
  mimetype,
  size: buffer.length,
  originalname,
});

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
    const photos = [photo(PNG, 'image/png', 'a.png')];
    controller.create({ photos }, dto);
    expect(productService.create).toHaveBeenCalledWith(dto, photos);
  });

  it('rejects a non-image mime type before writing anything', () => {
    const photos = [photo(Buffer.from('<html>'), 'text/html', 'a.html')];

    expect(() => controller.create({ photos }, dto)).toThrow(IMAGE_FORMAT_ERROR);
    expect(productService.create).not.toHaveBeenCalled();
  });

  it('rejects html renamed to png by checking the file signature', () => {
    const photos = [photo(Buffer.from('<html>'), 'image/png', 'a.png')];

    expect(() => controller.create({ photos }, dto)).toThrow(IMAGE_FORMAT_ERROR);
    expect(productService.create).not.toHaveBeenCalled();
  });

  it('rejects a photo larger than 10 MB', () => {
    const oversized = Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1);
    PNG.copy(oversized);
    const photos = [photo(oversized, 'image/png', 'a.png')];

    expect(() => controller.create({ photos }, dto)).toThrow(IMAGE_SIZE_ERROR);
    expect(productService.create).not.toHaveBeenCalled();
  });
});
