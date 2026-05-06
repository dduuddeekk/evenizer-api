import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/index.filter';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const port = process.env.PORT || 3000;
  const app = await NestFactory.create(AppModule);
  
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new GlobalExceptionFilter());
  
  await app.listen(port);
}
bootstrap();
