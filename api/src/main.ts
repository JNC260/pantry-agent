import 'dotenv/config';
import './config/check-env';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Railway sits one proxy in front of the app. Trusting it makes req.ip the
  // real client address, which the login rate limit is keyed on.
  app.set('trust proxy', 1);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { exposeUnsetFields: false },
    }),
  );
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3001',
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
