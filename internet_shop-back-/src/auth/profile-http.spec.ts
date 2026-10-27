import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { JwtStrategy } from './strategy/jwt.strategy';
import { UsersService } from 'src/user/user.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import {
  AUTH_ATTEMPTS_LIMIT,
  AUTH_ATTEMPTS_TTL,
  TOO_MANY_ATTEMPTS_MESSAGE,
} from './throttling';

const SECRET = 'profile-http-spec-secret';

const user = {
  id: 2,
  fullName: 'Тест Тестов',
  phoneNumber: '380991112233',
  password: 'secret-hash',
  roles: [{ value: 'USER' }],
};

const cartItems = [
  {
    id: 7,
    userId: user.id,
    productId: 12,
    size: 'M',
    quantity: 2,
    product: {
      id: 12,
      name: 'Джинси',
      cover: '/files/jeans-cover.jpg',
      sizes: ['S', 'M'],
      price: 1000,
      salePrice: null,
    },
  },
];

const usersService = {
  findForAuth: jest.fn(),
  getCartItems: jest.fn(),
};

// Той самий склад, що й у робочому застосунку: контролер з реальним JwtAuthGuard
// і AuthService, у якого автентифікація відділена від кошика профілю.
@Module({
  imports: [
    PassportModule,
    // ThrottlerGuard стоїть на login/register/change-password того ж контролера
    ThrottlerModule.forRoot({
      throttlers: [
        {
          limit: AUTH_ATTEMPTS_LIMIT,
          ttl: AUTH_ATTEMPTS_TTL,
        },
      ],
      errorMessage: TOO_MANY_ATTEMPTS_MESSAGE,
    }),
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    { provide: UsersService, useValue: usersService },
    AuthService,
    { provide: JwtService, useValue: { sign: jest.fn() } },
    { provide: getRepositoryToken(RefreshTokenEntity), useValue: {} },
  ],
})
class TestProfileModule {}

describe('GET /auth/profile over HTTP', () => {
  const originalSecret = process.env.JWT_SECRET;
  const jwt = new JwtService({ secret: SECRET });
  const userToken = `Bearer ${jwt.sign({ sub: user.id, phoneNumber: user.phoneNumber })}`;

  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;
    const moduleRef = await Test.createTestingModule({
      imports: [TestProfileModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // Ті самі пайп, що й у main.ts
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  beforeEach(() => {
    usersService.findForAuth.mockReset().mockResolvedValue(user);
    usersService.getCartItems.mockReset().mockResolvedValue(cartItems);
  });

  afterAll(async () => {
    await app.close();
    process.env.JWT_SECRET = originalSecret;
  });

  it('returns the user with the cart and the products in it', async () => {
    await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', userToken)
      .expect(200)
      .expect(res => {
        expect(res.body).toEqual({
          id: user.id,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          roles: user.roles,
          cartItems: cartItems,
        });
        expect(res.body).not.toHaveProperty('password');
      });

    // Кошик прочитано для профілю, а користувача для автентифікації — без нього
    expect(usersService.findForAuth).toHaveBeenCalledWith(user.id);
    expect(usersService.getCartItems).toHaveBeenCalledWith(user.id);
  });

  it('returns the user without a cart when the cart is empty', async () => {
    usersService.getCartItems.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', userToken)
      .expect(200)
      .expect(res => {
        expect(res.body.cartItems).toEqual([]);
      });
  });

  it('gives 401 without a token', async () => {
    await request(app.getHttpServer()).get('/auth/profile').expect(401);

    expect(usersService.findForAuth).not.toHaveBeenCalled();
    expect(usersService.getCartItems).not.toHaveBeenCalled();
  });

  it('gives 401 when the user is deleted', async () => {
    usersService.findForAuth.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', userToken)
      .expect(401);

    expect(usersService.getCartItems).not.toHaveBeenCalled();
  });
});
