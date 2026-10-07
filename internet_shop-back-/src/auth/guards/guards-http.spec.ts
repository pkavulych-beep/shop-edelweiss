import { Controller, Get, INestApplication, Module, Request, UseGuards } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { UsersService } from 'src/user/user.service';
import { Roles } from '../roles-auth.decorator';
import { RolesGuard } from '../roles.guard';
import { JwtStrategy } from '../strategy/jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';

const SECRET = 'guards-http-spec-secret';

// Той самий вигляд, що в адмінських контролерах: RolesGuard сам автентифікує запит
@Controller('admin-only')
@Roles('ADMIN')
@UseGuards(RolesGuard)
class AdminOnlyController {
  @Get()
  list() {
    return { ok: true };
  }
}

// Той самий вигляд, що в UserController: спершу JwtAuthGuard, потім RolesGuard
@UseGuards(JwtAuthGuard)
@Controller('admin-private')
class AdminPrivateController {
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @Get()
  list() {
    return { ok: true };
  }
}

// Звичний «свій» ендпоінт: лише JwtAuthGuard
@UseGuards(JwtAuthGuard)
@Controller('private')
class PrivateController {
  @Get()
  me(@Request() req) {
    return { id: req.user.id };
  }
}

@Module({
  imports: [PassportModule],
  controllers: [AdminOnlyController, AdminPrivateController, PrivateController],
  providers: [JwtStrategy, { provide: UsersService, useValue: { findById: jest.fn() } }],
})
class TestAuthModule {}

describe('Guards over HTTP', () => {
  const originalSecret = process.env.JWT_SECRET;
  const jwt = new JwtService({ secret: SECRET });

  const admin = {
    id: 1,
    phoneNumber: '380990000000',
    password: 'hash',
    roles: [{ value: 'USER' }, { value: 'ADMIN' }],
  };
  const user = {
    id: 2,
    phoneNumber: '380991111111',
    password: 'hash',
    roles: [{ value: 'USER' }],
  };

  const adminToken = jwt.sign({ sub: admin.id, phoneNumber: admin.phoneNumber });
  const userToken = jwt.sign({ sub: user.id, phoneNumber: user.phoneNumber });
  // Підпис справний, але id у вмісті немає — токен недійсний
  const malformedToken = jwt.sign({ phoneNumber: user.phoneNumber });

  let app: INestApplication;
  let usersService: { findById: jest.Mock };

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;
    const moduleRef = await Test.createTestingModule({ imports: [TestAuthModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    usersService = moduleRef.get(UsersService);
    usersService.findById.mockImplementation((id: number) =>
      Promise.resolve(id === admin.id ? admin : id === user.id ? user : null),
    );
  });

  afterAll(async () => {
    await app.close();
    process.env.JWT_SECRET = originalSecret;
  });

  const adminEndpoints: [string, string][] = [
    ['RolesGuard alone', '/admin-only'],
    ['JwtAuthGuard then RolesGuard', '/admin-private'],
  ];

  describe.each(adminEndpoints)('admin endpoint guarded by %s', (_, path) => {
    it('401 without an Authorization header', async () => {
      await request(app.getHttpServer()).get(path).expect(401);
    });

    it('401 with an invalid token', async () => {
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', 'Bearer not-a-token')
        .expect(401);
    });

    it('401 with a signed but malformed token', async () => {
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${malformedToken}`)
        .expect(401);
    });

    it('403 with a valid token of a user without the role', async () => {
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('200 with a valid admin token', async () => {
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('endpoint guarded by JwtAuthGuard only', () => {
    it('401 without an Authorization header', async () => {
      await request(app.getHttpServer()).get('/private').expect(401);
    });

    it('401 with an invalid token', async () => {
      await request(app.getHttpServer())
        .get('/private')
        .set('Authorization', 'Bearer not-a-token')
        .expect(401);
    });

    it('200 and the user from the database with a valid token', async () => {
      await request(app.getHttpServer())
        .get('/private')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect({ id: user.id });
    });
  });
});
