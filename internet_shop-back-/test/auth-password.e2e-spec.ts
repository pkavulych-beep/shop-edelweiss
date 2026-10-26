import 'dotenv/config';
import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { e2eDataSource } from './setup-e2e';
import { RoleEntity } from '../src/roles/entities/roles.entity';
import { UserEntity } from '../src/user/entities/user.entity';
import { RefreshTokenEntity } from '../src/auth/entities/refresh-token.entity';

async function ensureRoles(ds: DataSource) {
  const rolesRepo = ds.getRepository(RoleEntity);
  const userRole = await rolesRepo.findOne({ where: { value: 'USER' } });
  if (!userRole) {
    await rolesRepo.insert({ value: 'USER', description: 'Покупець' });
  }
}

describe('Password change (e2e)', () => {
  let app: INestApplication;
  let httpServer: any;
  const createdUserIds: number[] = [];
  const phone = `38067${Date.now().toString().slice(-7)}`;
  const password = 'oldpass123';
  const newPassword = 'newpass123';

  beforeAll(async () => {
    await e2eDataSource.initialize();
    await ensureRoles(e2eDataSource);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

    await app.init();
    httpServer = app.getHttpServer();
  }, 30000);

  afterAll(async () => {
    const userRepo = e2eDataSource.getRepository(UserEntity);
    const refreshTokenRepo = e2eDataSource.getRepository(RefreshTokenEntity);

    for (const userId of createdUserIds) {
      await refreshTokenRepo.delete({ userId });
      await userRepo.delete({ id: userId });
    }

    await app.close();
    await e2eDataSource.destroy();
  }, 30000);

  it('does not change the password through PATCH /users/:id', async () => {
    const register = await request(httpServer)
      .post('/auth/register')
      .send({ fullName: 'Password Test', phoneNumber: phone, password })
      .expect(201);

    const userId = register.body.userData.id;
    createdUserIds.push(userId);

    await request(httpServer)
      .patch(`/users/${userId}`)
      .set('Authorization', `Bearer ${register.body.token}`)
      .send({
        fullName: 'Password Test',
        phoneNumber: phone,
        password: 'hacked123',
      })
      .expect(200);

    await request(httpServer)
      .post('/auth/login')
      .send({ phoneNumber: phone, password: 'hacked123' })
      .expect(401);

    await request(httpServer)
      .post('/auth/login')
      .send({ phoneNumber: phone, password })
      .expect(201);
  });

  it('changes the password with the current one, revokes old sessions and returns a new pair', async () => {
    const login = await request(httpServer)
      .post('/auth/login')
      .send({ phoneNumber: phone, password })
      .expect(201);
    const accessToken = login.body.token;
    const oldRefreshToken = login.body.refreshToken;

    const wrong = await request(httpServer)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'wrongpass', newPassword })
      .expect(400);
    expect(wrong.body.message).toBe('Неправильний поточний пароль');

    const changed = await request(httpServer)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: password, newPassword })
      .expect(200);

    expect(changed.body).toEqual({
      token: expect.any(String),
      refreshToken: expect.any(String),
    });
    expect(changed.body.refreshToken).not.toBe(oldRefreshToken);

    await request(httpServer)
      .post('/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(401);

    await request(httpServer)
      .post('/auth/refresh')
      .send({ refreshToken: changed.body.refreshToken })
      .expect(200);

    await request(httpServer)
      .post('/auth/login')
      .send({ phoneNumber: phone, password })
      .expect(401);

    await request(httpServer)
      .post('/auth/login')
      .send({ phoneNumber: phone, password: newPassword })
      .expect(201);
  });

  it('requires authentication for change-password', async () => {
    await request(httpServer)
      .post('/auth/change-password')
      .send({ currentPassword: newPassword, newPassword: 'another123' })
      .expect(401);
  });
});
