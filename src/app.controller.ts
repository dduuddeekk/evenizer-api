import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';
import { APIResponse, ErrorResponse } from './common/dto/index.dto';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): APIResponse<{ value: string; version: string }> {
    return this.appService.getHello();
  }

  @Get('health')
  async checkHealth(): Promise<APIResponse<string>> {
    try {
      // Cek koneksi ke database
      await this.prisma.$queryRaw`SELECT 1`;

      return new APIResponse<string>(HttpStatus.OK, 'Server is healthy', 'Database connection OK');
    } catch (error) {
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Health check failed', error.message),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
