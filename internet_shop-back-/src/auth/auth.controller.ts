import { Controller, Post, UseGuards, Request, Get, Body } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { AuthService } from './auth.service';
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
}
