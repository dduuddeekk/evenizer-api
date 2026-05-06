import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/';
import { join } from 'path';

async function bootstrap() {
  const port = process.env.PORT!;
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useStaticAssets(join(__dirname, '..', 'src', 'storage'), {
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

  await app.listen(port);
}
bootstrap();
