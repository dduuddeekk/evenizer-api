import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UploadModule } from '../upload/upload.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [UploadModule, EmailModule],
  providers: [UserService],
  controllers: [UserController]
})
export class UserModule {}
