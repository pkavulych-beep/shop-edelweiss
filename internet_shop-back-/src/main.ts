import 'dotenv/config';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { resolveCorsOrigin, resolveTrustProxy } from './config/security';

async function bootstrap() {
  // rawBody: підпис вебхука mono перевіряється над сирими байтами тіла
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // За nginx без цього ThrottlerGuard бачить IP проксі й ділить один ліміт між усіма.
  const trustProxy = resolveTrustProxy();
  if (trustProxy !== undefined) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxy);
  }

  // Токени передаються в заголовку Authorization, тому credentials (cookie) не потрібні.
  app.enableCors({
    origin: resolveCorsOrigin(),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 200,
    allowedHeaders:
      'Origin,X-Requested-With,Content-Type,Accept,Authorization,authorization,X-Forwarded-for',
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  await app.listen(process.env.PORT || 7777);
}

bootstrap();
