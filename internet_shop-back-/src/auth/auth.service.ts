import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { IsNull, LessThan, Repository } from 'typeorm';
import { RoleEntity } from 'src/roles/entities/roles.entity';
import { UsersService } from 'src/user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { normalizePhone, UA_PHONE_PATTERN } from '../common/phone';
import { hashPassword, isPasswordHash, verifyPassword } from './password';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { ChangePasswordDto } from './dto/change-password.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

export function refreshTokenTtlMs(): number {
  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30;
  return days * DAY_MS;
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(RefreshTokenEntity)
    private refreshTokens: Repository<RefreshTokenEntity>,
  ) {}

  async validateUser(phoneNumber: string, password: string): Promise<any> {
    const phone = normalizePhone(phoneNumber);
    // Номер, який не вдається звести до українського, шукати зайве
    if (typeof phone !== 'string' || !UA_PHONE_PATTERN.test(phone)) {
      return null;
    }
    const user = await this.usersService.findByPhoneWithPassword(phone);
    if (!user || !(await verifyPassword(password, user.password))) {
      return null;
    }
    if (!isPasswordHash(user.password)) {
      await this.usersService.setPasswordHash(
        user.id,
        await hashPassword(password),
      );
    }
    const { password: _password, ...result } = user;
    return result;
  }

  generateJwtToken(data: {
    phoneNumber: string;
    id: number;
    roles: RoleEntity[];
  }) {
    const payload = {
      phoneNumber: data.phoneNumber,
      sub: data.id,
      roles: data.roles,
    };
    return this.jwtService.sign(payload);
  }

  // Короткий access-токен (JWT) і refresh-токен, яким його потім оновлюють
  async issueTokens(user: {
    phoneNumber: string;
    id: number;
    roles: RoleEntity[];
  }) {
    const now = new Date();
    const refreshToken = randomBytes(48).toString('base64url');

    // Заразом прибираємо прострочені токени цього користувача, щоб таблиця не росла
    await this.refreshTokens.delete({ userId: user.id, expiresAt: LessThan(now) });
    await this.refreshTokens.insert({
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(now.getTime() + refreshTokenTtlMs()),
    });

    return { token: this.generateJwtToken(user), refreshToken };
  }

  async refresh(refreshToken: string) {
    const stored = await this.refreshTokens.findOne({
      where: { tokenHash: hashRefreshToken(refreshToken) },
    });
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('Сесія завершилася, увійдіть знову');
    }

    // Відкликаємо умовно: з двох одночасних запитів з тим самим токеном
    // новий токен отримає лише один
    const { affected } = await this.refreshTokens.update(
      { id: stored.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (!affected) {
      throw new UnauthorizedException('Сесія завершилася, увійдіть знову');
    }

    // Для видачі токенів потрібні лише id і ролі, без кошика
    const user = await this.usersService.findForAuth(stored.userId);
    if (!user) {
      throw new UnauthorizedException('Сесія завершилася, увійдіть знову');
    }
    return this.issueTokens(user);
  }

  async logout(refreshToken: string) {
    await this.refreshTokens.update(
      { tokenHash: hashRefreshToken(refreshToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  // Профіль — єдиний захищений запит, якому потрібен кошик: JwtStrategy його
  // не тягне, тому тут довантажуємо позиції самі
  async getProfile(user: { id: number }) {
    const cartItems = await this.usersService.getCartItems(user.id);
    return { ...user, cartItems };
  }


  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user || !(await verifyPassword(dto.currentPassword, user.password))) {
      throw new BadRequestException('Неправильний поточний пароль');
    }

    await this.usersService.setPasswordHash(
      userId,
      await hashPassword(dto.newPassword),
    );

    // Після зміни пароля всі старі сесії мають завершитися, але поточна
    // отримує нову пару токенів, щоб користувачу не довелося входити знову
    await this.refreshTokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return this.issueTokens(user);
  }

  async login(user: any) {
    const { password, ...userData } = user;

    return {
      userData,
      ...(await this.issueTokens(userData)),
    };
  }

  async register(dto: CreateUserDto) {
    try {
      const { password, ...userData } = await this.usersService.create(dto);
      return {
        userData,
        ...(await this.issueTokens(userData)),
      };
    } catch (e) {
      if (e instanceof HttpException) {
        throw e;
      }
      console.error(e);
      throw new InternalServerErrorException('Помилка під час реєстрації');
    }
  }
}
