import 'dotenv/config';
import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { e2eDataSource } from './setup-e2e';
import { RoleEntity } from '../src/roles/entities/roles.entity';
import { ProductEntity } from '../src/product/entities/product.entity';
import { UserEntity } from '../src/user/entities/user.entity';
import { OrderEntity } from '../src/order/entities/order.entity';
import { OrderItemEntity } from '../src/order/entities/order-item.entity';
import { RefreshTokenEntity } from '../src/auth/entities/refresh-token.entity';
import { ProductStatus } from '../src/product/entities/product.entity';
import { Status } from '../src/order/statusEnum';
import { DataSource } from 'typeorm';

function generatePhone(): string {
  return `38066${Date.now().toString().slice(-7)}`;
}

async function ensureRoles(ds: DataSource) {
  const rolesRepo = ds.getRepository(RoleEntity);
  const userRole = await rolesRepo.findOne({ where: { value: 'USER' } });
  const adminRole = await rolesRepo.findOne({ where: { value: 'ADMIN' } });
  if (!userRole) {
    await rolesRepo.insert({ value: 'USER', description: 'Покупець' });
  }
  if (!adminRole) {
    await rolesRepo.insert({ value: 'ADMIN', description: 'Адміністратор' });
  }
}

async function createTestProduct(ds: DataSource): Promise<ProductEntity> {
  const productRepo = ds.getRepository(ProductEntity);
  const product = productRepo.create({
    name: `Test Product ${Date.now()}`,
    description: 'Test product for e2e',
    price: 100,
    salePrice: 0,
    sizes: ['M', 'L'],
    colors: ['red'],
    status: ProductStatus.Active,
    count: 10,
    gender: 'unisex' as any,
    category: 'tshirts' as any,
    season: 'all-season' as any,
  });
  return productRepo.save(product);
}

describe('Order flow (e2e)', () => {
  let app: INestApplication;
  let httpServer: any;
  const createdUserIds: number[] = [];
  const createdProductIds: number[] = [];

  beforeAll(async () => {
    await e2eDataSource.initialize();
    await ensureRoles(e2eDataSource);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.enableCors({
      origin: '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      preflightContinue: false,
      optionsSuccessStatus: 200,
      credentials: true,
      allowedHeaders:
        'Origin,X-Requested-With,Content-Type,Accept,Authorization,authorization,X-Forwarded-for',
    });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

    await app.init();
    httpServer = app.getHttpServer();
  }, 30000);

  afterAll(async () => {
    const orderItemRepo = e2eDataSource.getRepository(OrderItemEntity);
    const orderRepo = e2eDataSource.getRepository(OrderEntity);
    const userRepo = e2eDataSource.getRepository(UserEntity);
    const refreshTokenRepo = e2eDataSource.getRepository(RefreshTokenEntity);
    const productRepo = e2eDataSource.getRepository(ProductEntity);

    for (const userId of createdUserIds) {
      await refreshTokenRepo.delete({ userId });
      const orders = await orderRepo.find({ where: { user: { id: userId } } });
      for (const order of orders) {
        await orderItemRepo.delete({ order: { id: order.id } });
      }
      await orderRepo.delete({ user: { id: userId } });
      await userRepo.delete({ id: userId });
    }

    if (createdProductIds.length > 0) {
      await productRepo.delete(createdProductIds);
    }

    await app.close();
    await e2eDataSource.destroy();
  }, 30000);

  it('register → login → order → my orders → 401 without token', async () => {
    const phone = generatePhone();
    const password = 'test12345';
    const fullName = 'Test User';

    const product = await createTestProduct(e2eDataSource);
    createdProductIds.push(product.id);
    expect(product.id).toBeDefined();

    // 1. POST /auth/register
    const registerRes = await request(httpServer)
      .post('/auth/register')
      .send({ fullName, phoneNumber: phone, password })
      .expect(201);

    expect(registerRes.body).toHaveProperty('token');
    expect(registerRes.body).toHaveProperty('refreshToken');
    expect(registerRes.body.userData).toHaveProperty('id');
    expect(registerRes.body.userData.phoneNumber).toBe(phone);

    const userId = registerRes.body.userData.id;
    createdUserIds.push(userId);

    // 2. POST /auth/login
    const loginRes = await request(httpServer)
      .post('/auth/login')
      .send({ phoneNumber: phone, password })
      .expect(201);

    expect(loginRes.body).toHaveProperty('token');
    expect(loginRes.body).toHaveProperty('refreshToken');
    const loginToken = loginRes.body.token;

    // 3. POST /order with token
    const orderRes = await request(httpServer)
      .post('/order')
      .set('Authorization', `Bearer ${loginToken}`)
      .send({
        items: [{ productId: product.id, size: 'M', quantity: 2 }],
        cityName: 'Kyiv',
        department: 'Department #1',
      })
      .expect(201);

    expect(orderRes.body).toHaveProperty('id');
    expect(orderRes.body.items).toHaveLength(1);
    expect(orderRes.body.items[0].productId).toBe(product.id);
    expect(orderRes.body.items[0].size).toBe('M');
    expect(orderRes.body.items[0].quantity).toBe(2);
    expect(orderRes.body.items[0].price).toBe(product.price);
    expect(orderRes.body.total).toBe(product.price * 2);
    expect(orderRes.body.status).toBe(Status.Processed);
    expect(orderRes.body.cityName).toBe('Kyiv');
    expect(orderRes.body.department).toBe('Department #1');

    const orderId = orderRes.body.id;

    // 4. GET /order/my - verify order is in list with correct items, quantity, price
    const myOrdersRes = await request(httpServer)
      .get('/order/my')
      .set('Authorization', `Bearer ${loginToken}`)
      .expect(200);

    expect(Array.isArray(myOrdersRes.body)).toBe(true);
    expect(myOrdersRes.body.length).toBeGreaterThanOrEqual(1);

    const myOrder = myOrdersRes.body.find((o: any) => o.id === orderId);
    expect(myOrder).toBeDefined();
    expect(myOrder.items).toHaveLength(1);
    expect(myOrder.items[0].productId).toBe(product.id);
    expect(myOrder.items[0].size).toBe('M');
    expect(myOrder.items[0].quantity).toBe(2);
    expect(myOrder.items[0].price).toBe(product.price);
    expect(myOrder.total).toBe(product.price * 2);
    expect(myOrder.status).toBe(Status.Processed);

    // 5. POST /order without token - should return 401
    await request(httpServer)
      .post('/order')
      .send({
        items: [{ productId: product.id, size: 'M', quantity: 1 }],
        cityName: 'Kyiv',
        department: 'Department #1',
      })
      .expect(401);
  }, 30000);
});