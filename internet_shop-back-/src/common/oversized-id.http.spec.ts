import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { OrderController } from 'src/order/order.controller';
import { OrderService } from 'src/order/order.service';
import { Status } from 'src/order/statusEnum';
import { PhotosController } from 'src/photos/photos.controller';
import { PhotosService } from 'src/photos/photos.service';
import { ProductController } from 'src/product/product.controller';
import { ProductService } from 'src/product/product.service';
import { UserController } from 'src/user/user.controller';
import { UsersService } from 'src/user/user.service';

const SECRET = 'oversized-id-http-spec-secret';
// Більший за межу PostgreSQL integer (2147483647): такого id в базі не буває
const HUGE = '99999999999';

const usersService = {
  findById: jest.fn(),
  findOrders: jest.fn(),
  cleanTheBasket: jest.fn(),
  update: jest.fn(),
  addProductToBasket: jest.fn(),
  pickUpFromTheBasket: jest.fn(),
  syncCart: jest.fn(),
};
const productService = {
  findOne: jest.fn(),
  findOnlyPhotos: jest.fn(),
  findByIds: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};
const orderService = {
  create: jest.fn(),
  findOneForUser: jest.fn(),
  updateStatus: jest.fn(),
  remove: jest.fn(),
};
const photosService = { remove: jest.fn() };

// Той самий склад, що й у робочому застосунку: контролери, глобальна
// валідація та RolesGuard, який автентифікує запит через JwtStrategy.
@Module({
  imports: [PassportModule],
  controllers: [ProductController, OrderController, UserController, PhotosController],
  providers: [
    JwtStrategy,
    { provide: UsersService, useValue: usersService },
    { provide: ProductService, useValue: productService },
    { provide: OrderService, useValue: orderService },
    { provide: PhotosService, useValue: photosService },
  ],
})
class TestOversizedIdModule {}

describe('an id bigger than PostgreSQL integer', () => {
  const originalSecret = process.env.JWT_SECRET;
  const jwt = new JwtService({ secret: SECRET });
  const adminHeaders = {
    Authorization: `Bearer ${jwt.sign({ sub: 1, phoneNumber: '380990000000' })}`,
  };

  let app: INestApplication;

  const serviceMocks = [
    usersService,
    productService,
    orderService,
    photosService,
  ] as Record<string, jest.Mock>[];

  const receivedHugeId = (mock: jest.Mock) =>
    mock.mock.calls.some(([first]) => first === Number(HUGE));

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;

    const moduleRef = await Test.createTestingModule({
      imports: [TestOversizedIdModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // Ті самі опції, що й у main.ts
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  beforeEach(() => {
    serviceMocks.forEach(mocks =>
      Object.values(mocks).forEach(mock => mock.mockReset()),
    );
    // JwtStrategy читає користувача з бази на кожен запит із токеном
    usersService.findById.mockResolvedValue({
      id: 1,
      password: 'secret',
      roles: [{ value: 'ADMIN' }],
    });
    productService.findOne.mockResolvedValue({ id: 5 });
    productService.findOnlyPhotos.mockResolvedValue([]);
    orderService.findOneForUser.mockResolvedValue({ id: 1 });
    orderService.updateStatus.mockResolvedValue({ id: 1 });
    orderService.remove.mockResolvedValue('ok');
    photosService.remove.mockResolvedValue({ affected: 0 });
  });

  afterAll(async () => {
    await app.close();
    process.env.JWT_SECRET = originalSecret;
  });

  const notFound: [string, string, object | undefined, jest.Mock, string][] = [
    ['GET', `/product/${HUGE}`, undefined, productService.findOne, 'Товар не знайдено'],
    ['PATCH', `/product/${HUGE}`, { price: 1000 }, productService.update, 'Товар не знайдено'],
    ['DELETE', `/product/${HUGE}`, undefined, productService.remove, 'Товар не знайдено'],
    ['GET', `/product/photos/${HUGE}`, undefined, productService.findOnlyPhotos, 'Товар не знайдено'],
    ['GET', `/order/${HUGE}`, undefined, orderService.findOneForUser, 'Не знайдено такого замовлення'],
    [
      'PATCH',
      `/order/${HUGE}/status`,
      { status: Status.Sent },
      orderService.updateStatus,
      'Не знайдено такого замовлення',
    ],
    ['DELETE', `/order/${HUGE}`, undefined, orderService.remove, 'Не знайдено такого замовлення'],
    ['GET', `/users/${HUGE}`, undefined, usersService.findById, 'Користувача не знайдено'],
    ['GET', `/users/order/${HUGE}`, undefined, usersService.findOrders, 'Користувача не знайдено'],
    [
      'PATCH',
      `/users/${HUGE}`,
      { fullName: 'Тест Тестов', phoneNumber: '380991112222' },
      usersService.update,
      'Користувача не знайдено',
    ],
    ['DELETE', `/users/basket/${HUGE}`, undefined, usersService.cleanTheBasket, 'Користувача не знайдено'],
    ['DELETE', `/photos/${HUGE}`, undefined, photosService.remove, 'Фото не знайдено'],
  ];

  const call = (method: string, url: string) => {
    const req = request(app.getHttpServer());
    switch (method) {
      case 'GET':
        return req.get(url);
      case 'PATCH':
        return req.patch(url);
      default:
        return req.delete(url);
    }
  };

  it.each(notFound)('%s %s answers 404 instead of 500', async (method, url, body, serviceMock, message) => {
    const req = call(method, url).set(adminHeaders);
    if (body) {
      req.send(body);
    }

    await req.expect(404).expect({ statusCode: 404, message });
    expect(receivedHugeId(serviceMock)).toBe(false);
  });

  // Ті сами запити з різним id у тілі: межі DTO перевіряються до того, як id потрапить у SQL
  const bodiesWithId = (id: number): [string, () => any, () => jest.Mock][] => [
    [
      'POST /order',
      () => request(app.getHttpServer()).post('/order').set(adminHeaders).send({
        items: [{ productId: id, quantity: 1 }],
        cityName: 'Київ',
        department: 'Відділення №1',
      }),
      () => orderService.create,
    ],
    [
      'POST /product/byIds',
      () => request(app.getHttpServer()).post('/product/byIds').send({ ids: [id] }),
      () => productService.findByIds,
    ],
    [
      'PATCH /users/addProduct',
      () =>
        request(app.getHttpServer())
          .patch('/users/addProduct')
          .set(adminHeaders)
          .send({ idProduct: id, size: 'M' }),
      () => usersService.addProductToBasket,
    ],
    [
      'PATCH /users/pickUpFromTheBasket',
      () =>
        request(app.getHttpServer())
          .patch('/users/pickUpFromTheBasket')
          .set(adminHeaders)
          .send({ idProduct: id, size: 'M' }),
      () => usersService.pickUpFromTheBasket,
    ],
    [
      'POST /users/syncCart',
      () =>
        request(app.getHttpServer())
          .post('/users/syncCart')
          .set(adminHeaders)
          .send({ items: [{ productId: id, quantity: 1, size: 'M' }] }),
      () => usersService.syncCart,
    ],
  ];

  const expectBadRequest = async (
    send: () => any,
    serviceMock: () => jest.Mock,
    message: string,
  ) => {
    await send()
      .expect(400)
      .expect(res => {
        expect(res.body.message).toEqual(
          expect.arrayContaining([expect.stringContaining(message)]),
        );
      });
    expect(serviceMock()).not.toHaveBeenCalled();
  };

  it.each(bodiesWithId(Number(HUGE)))(
    '%s answers 400 instead of 500 for an id bigger than PostgreSQL integer',
    async (_name, send, serviceMock) =>
      expectBadRequest(send, serviceMock, 'Ідентифікатор товару занадто великий'),
  );

  it.each(bodiesWithId(Number(HUGE) * -1))(
    '%s answers 400 instead of 500 for a negative id',
    async (_name, send, serviceMock) => expectBadRequest(send, serviceMock, 'більшим за 0'),
  );

  it.each(bodiesWithId(1.5))(
    '%s answers 400 instead of 500 for a fractional id',
    async (_name, send, serviceMock) => expectBadRequest(send, serviceMock, 'цілим числом'),
  );

  it('GET /product/5 still reads the product', async () => {
    await request(app.getHttpServer())
      .get('/product/5')
      .expect(200)
      .expect({ id: 5 });
    expect(productService.findOne).toHaveBeenCalledWith(5);
  });

  it('DELETE /photos/5 still deletes the photo', async () => {
    await request(app.getHttpServer())
      .delete('/photos/5')
      .set(adminHeaders)
      .expect(200);
    expect(photosService.remove).toHaveBeenCalledWith(5);
  });

  it('GET /product/abc still answers 400', async () => {
    await request(app.getHttpServer()).get('/product/abc').expect(400);
    expect(productService.findOne).not.toHaveBeenCalled();
  });
});
