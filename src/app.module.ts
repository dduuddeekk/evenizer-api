import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UploadModule } from './upload/upload.module';
import { EventModule } from './event/event.module';
import { OrganizerModule } from './organizer/organizer.module';
import { TicketModule } from './ticket/ticket.module';

@Module({
  imports: [UserModule, AuthModule, PrismaModule, UploadModule, EventModule, OrganizerModule, TicketModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
