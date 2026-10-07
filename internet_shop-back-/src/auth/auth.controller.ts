import { Controller, Post, UseGuards, Request, Get, Body, HttpCode } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AUTH_ATTEMPTS_LIMIT, AUTH_ATTEMPTS_TTL } from './throttling';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(ThrottlerGuard, LocalAuthGuard)
  @Throttle({
    default: { limit: AUTH_ATTEMPTS_LIMIT, ttl: AUTH_ATTEMPTS_TTL },
  })
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: AUTH_ATTEMPTS_LIMIT, ttl: AUTH_ATTEMPTS_TTL },
  })
  @Post('register')
  register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  // Новий access-токен за refresh-токеном; старий refresh-токен після цього недійсний
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // Без JwtAuthGuard: access-токен на момент виходу вже може бути простроченим
  @HttpCode(204)
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }
}
