import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { UsersService } from 'src/user/user.service';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

const SECRET = 'product-http-spec-secret';

const usersService = { findById: jest.fn() };
const productService = {
  create: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  findFiltered: jest.fn(),
};

// Той самий склад, що й у робочому застосунку: контролер, глобальна валідація
// та RolesGuard, який автентифікує запит через JwtStrategy.
@Module({
  imports: [PassportModule],
  controllers: [ProductController],
  providers: [
    JwtStrategy,
    { provide: UsersService, useValue: usersService },
    { provide: ProductService, useValue: productService },
  ],
})
class TestProductModule {}

describe('ProductController over HTTP', () => {
  const originalSecret = process.env.JWT_SECRET;
  const jwt = new JwtService({ secret: SECRET });
  const adminHeaders = {
    Authorization: `Bearer ${jwt.sign({ sub: 1, phoneNumber: '380990000000' })}`,
  };

  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;
    usersService.findById.mockResolvedValue({
      id: 1,
      password: 'secret',
      roles: [{ value: 'ADMIN' }],
    });

    const moduleRef = await Test.createTestingModule({
      imports: [TestProductModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // Ті самі опції, що й у main.ts
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  beforeEach(() => {
    productService.findOne.mockReset().mockResolvedValue({ id: 1 });
    productService.update.mockReset().mockResolvedValue({ id: 1 });
    productService.remove.mockReset().mockResolvedValue('ok');
    productService.create.mockReset().mockResolvedValue({ id: 1 });
    productService.findFiltered.mockReset().mockResolvedValue({
      data: [],
      total: 0,
    });
  });

  afterAll(async () => {
    await app.close();
    process.env.JWT_SECRET = originalSecret;
  });

  describe('a non-numeric :id', () => {
    it('GET /product/abc answers 400 instead of 500', async () => {
      await request(app.getHttpServer())
        .get('/product/abc')
        .expect(400)
        .expect({
          statusCode: 400,
          message: 'Validation failed (numeric string is expected)',
          error: 'Bad Request',
        });
      expect(productService.findOne).not.toHaveBeenCalled();
    });

    it('PATCH /product/abc answers 400 for an admin', async () => {
      await request(app.getHttpServer())
        .patch('/product/abc')
        .set(adminHeaders)
        .send({ price: 1000 })
        .expect(400);
      expect(productService.update).not.toHaveBeenCalled();
    });

    it('DELETE /product/abc answers 400 for an admin', async () => {
      await request(app.getHttpServer())
        .delete('/product/abc')
        .set(adminHeaders)
        .expect(400);
      expect(productService.remove).not.toHaveBeenCalled();
    });
  });

  describe('a non-numeric price', () => {
    it('PATCH /product/1 answers 400 with a Ukrainian message', async () => {
      await request(app.getHttpServer())
        .patch('/product/1')
        .set(adminHeaders)
        .send({ price: 'abc' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(['Ціна має бути цілим числом']);
        });
      expect(productService.update).not.toHaveBeenCalled();
    });

    it('PATCH /product/1 still updates with a valid price', async () => {
      await request(app.getHttpServer())
        .patch('/product/1')
        .set(adminHeaders)
        .send({ price: 1000, count: 5 })
        .expect(200);
      expect(productService.update).toHaveBeenCalledWith(1, {
        price: 1000,
        count: 5,
      });
    });

    it('POST /product reads the price from FormData', async () => {
      await request(app.getHttpServer())
        .post('/product')
        .set(adminHeaders)
        .field('name', 'Куртка')
        .field('description', 'Тепла куртка для зимових прогулянок містом')
        .field('gender', 'man')
        .field('price', '1000')
        .field('count', '5')
        .attach('photos', Buffer.from('photo'), 'photo.png')
        .expect(201);

      expect(productService.create).toHaveBeenCalledWith(
        expect.objectContaining({ price: 1000, count: 5 }),
        expect.any(Array),
      );
    });

    it('POST /product answers 400 for a non-numeric price', async () => {
      await request(app.getHttpServer())
        .post('/product')
        .set(adminHeaders)
        .field('name', 'Куртка')
        .field('description', 'Тепла куртка для зимових прогулянок містом')
        .field('gender', 'man')
        .field('price', 'abc')
        .attach('photos', Buffer.from('photo'), 'photo.png')
        .expect(400);

      expect(productService.create).not.toHaveBeenCalled();
    });
  });

  describe('an unknown filter enum value', () => {
    it.each(['category=bogus', 'season=zzz', 'category=dresses,bogus'])(
      'GET /product/filter?%s answers 400 instead of 500',
      async query => {
        await request(app.getHttpServer())
          .get(`/product/filter?${query}`)
          .expect(400)
          .expect(res => {
            expect(res.body.message).toEqual(expect.arrayContaining([expect.any(String)]));
          });
        expect(productService.findFiltered).not.toHaveBeenCalled();
      },
    );

    it('GET /product/filter passes a known category to the service', async () => {
      await request(app.getHttpServer())
        .get('/product/filter?category=dresses')
        .expect(200);
      expect(productService.findFiltered).toHaveBeenCalledWith({
        category: 'dresses',
      });
    });

    it.each(['category=dresses&category=hoodies', 'season=a&season=b'])(
      'GET /product/filter?%s answers 400 for a repeated param',
      async query => {
        await request(app.getHttpServer())
          .get(`/product/filter?${query}`)
          .expect(400);
        expect(productService.findFiltered).not.toHaveBeenCalled();
      },
    );
  });

  it('DELETE /product/1 removes the product for an admin', async () => {
    await request(app.getHttpServer())
      .delete('/product/1')
      .set(adminHeaders)
      .expect(200);
    expect(productService.remove).toHaveBeenCalledWith(1);
  });
});
