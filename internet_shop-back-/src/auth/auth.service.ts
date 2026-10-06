import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RoleEntity } from 'src/roles/entities/roles.entity';
import { UsersService } from 'src/user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { hashPassword, isPasswordHash, verifyPassword } from './password';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(phoneNumber: string, password: string): Promise<any> {
    const user = await this.usersService.findByPhoneWithPassword(phoneNumber);
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

  async login(user: any) {
    const { password, ...userData } = user;

    return {
      userData,
      token: this.generateJwtToken(userData),
    };
  }

  async register(dto: CreateUserDto) {
    try {
      const { password, ...userData } = await this.usersService.create(dto);
      return {
        userData,
        token: this.generateJwtToken(userData),
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
