import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/';
import { join } from 'path';
import type { Request, Response } from 'express';

function getStorageRoot() {
  return process.env.VERCEL
    ? join('/tmp', 'evenizer-storage')
    : join(process.cwd(), 'src', 'storage');
}

let cachedApp: NestExpressApplication | null = null;
let cachedHandler: ((req: Request, res: Response) => unknown) | null = null;

async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useStaticAssets(getStorageRoot(), {
    prefix: '/storage/',
  });

  const config = new DocumentBuilder()
    .setTitle('Evenizer API')
    .setDescription('The Evenizer API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.init();

  return app;
}

async function getHandler() {
  if (!cachedApp) {
    cachedApp = await createApp();
    cachedHandler = cachedApp.getHttpAdapter().getInstance();
  }

  if (!cachedHandler) {
    throw new Error('Failed to initialize the HTTP handler');
  }

  return cachedHandler;
}

async function bootstrap() {
  const port = Number(process.env.PORT || 3000);
  const app = await createApp();

  await app.listen(port);
}

export default async function handler(req: Request, res: Response) {
  const expressHandler = await getHandler();
  return expressHandler(req, res);
}

if (!process.env.VERCEL) {
  void bootstrap();
}
