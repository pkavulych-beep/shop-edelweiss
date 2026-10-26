import { ThrottlerGuard, seconds } from '@nestjs/throttler';

export const QUICK_ORDER_LIMIT = 5;
export const QUICK_ORDER_TTL = seconds(600);
export const QUICK_ORDER_THROTTLE_MESSAGE = 'Забагато заявок. Спробуйте пізніше.';

// Свій guard, бо @Throttle не дозволяє перевизначити повідомлення на маршруті
export class QuickOrderThrottlerGuard extends ThrottlerGuard {
  protected async getErrorMessage(): Promise<string> {
    return QUICK_ORDER_THROTTLE_MESSAGE;
  }
}
