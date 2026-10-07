import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: { sub?: unknown; phoneNumber?: string }) {
    // Підпис токена може бути справним, але вміст — ні: без id, з id не-числом
    // чи з id, якого немає в базі. Такий токен недійсний, тому 401, а не 500.
    const rawId = payload?.sub;
    const id =
      typeof rawId === 'number' || (typeof rawId === 'string' && /^\d+$/.test(rawId))
        ? Number(rawId)
        : NaN;
    if (!Number.isInteger(id) || id <= 0) {
      throw new UnauthorizedException('У вас немає доступу до цієї сторінки');
    }

    const user = await this.usersService.findById(id);

    if (!user) {
      throw new UnauthorizedException('У вас немає доступу до цієї сторінки');
    }
    const { password, ...res } = user;
    return res;
  }
}
