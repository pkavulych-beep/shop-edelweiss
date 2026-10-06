import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ROLES_KEY } from './roles-auth.decorator';

// Спершу автентифікує запит через JwtStrategy (вона щоразу читає користувача
// з бази й кладе його в req.user), а потім перевіряє ролі саме цього користувача.
// Ролі з вмісту токена не використовуються: інакше зміна ролей діяла б лише
// після закінчення терміну дії токена.
@Injectable()
export class RolesGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }

    // Без токена, з недійсним токеном чи для видаленого користувача — 401
    await super.canActivate(context);

    const { user } = context.switchToHttp().getRequest();
    const hasRole = user?.roles?.some(role => requiredRoles.includes(role.value));
    if (!hasRole) {
      throw new ForbiddenException('Немає доступу');
    }
    return true;
  }
}
