import { seconds } from '@nestjs/throttler';

export const AUTH_ATTEMPTS_LIMIT = 5;
export const AUTH_ATTEMPTS_TTL = seconds(60);

export const TOO_MANY_ATTEMPTS_MESSAGE =
  'Забагато спроб. За хвилину можна не більше 5 спроб. Спробуйте пізніше.';
