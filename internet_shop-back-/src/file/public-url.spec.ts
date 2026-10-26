import { instanceToPlain } from 'class-transformer';
import { getBaseUrl, toPublicFileUrl } from './public-url';
import { ProductEntity } from '../product/entities/product.entity';
import { PhotoEntity } from '../photos/entities/photo.entity';

describe('public file urls', () => {
  const original = process.env.BASE_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.BASE_URL;
    else process.env.BASE_URL = original;
  });

  it('uses BASE_URL with a trailing slash and falls back to localhost', () => {
    process.env.BASE_URL = 'https://shop.example/api';
    expect(getBaseUrl()).toBe('https://shop.example/api/');

    delete process.env.BASE_URL;
    expect(getBaseUrl()).toBe('http://localhost:7777/');
  });

  it('builds a public url from a relative path and keeps empty values', () => {
    process.env.BASE_URL = 'https://shop.example/';

    expect(toPublicFileUrl('image/photo.png')).toBe('https://shop.example/image/photo.png');
    expect(toPublicFileUrl(null)).toBeNull();
    expect(toPublicFileUrl(undefined)).toBeUndefined();
  });

  it('serializes the product cover with the current BASE_URL', () => {
    process.env.BASE_URL = 'https://shop.example/';
    const product = new ProductEntity();
    product.cover = 'image/cover.png';

    expect(instanceToPlain(product).cover).toBe('https://shop.example/image/cover.png');

    process.env.BASE_URL = 'http://localhost:7780/';
    expect(instanceToPlain(product).cover).toBe('http://localhost:7780/image/cover.png');
  });

  it('serializes the photo url with the current BASE_URL', () => {
    process.env.BASE_URL = 'https://shop.example/';
    const photo = new PhotoEntity();
    photo.url = 'image/photo.png';

    expect(instanceToPlain(photo).url).toBe('https://shop.example/image/photo.png');
  });

  it('keeps a null product cover as null', () => {
    const product = new ProductEntity();
    product.cover = null;

    expect(instanceToPlain(product).cover).toBeNull();
  });
});
