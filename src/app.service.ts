import { Injectable, HttpStatus } from '@nestjs/common';
import { APIResponse } from './common/dto';

@Injectable()
export class AppService {
  getHello(): APIResponse<{ value: string; version: string }> {
    return new APIResponse<{ value: string; version: string }>(
      HttpStatus.OK,
      'API is running.',
      {
        value: 'Welcome to Evenizer API',
        version: '1.0.0-beta'
      }
    );
  }
}
