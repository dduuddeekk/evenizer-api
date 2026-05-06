import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [UploadModule],
  providers: [UserService],
  controllers: [UserController]
})
export class UserModule {}
