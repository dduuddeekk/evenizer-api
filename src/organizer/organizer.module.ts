import { Module } from '@nestjs/common';
import { OrganizerService } from './organizer.service';
import { OrganizerController } from './organizer.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';
import { MlModule } from '../ml/ml.module';

@Module({
  imports: [PrismaModule, UploadModule, MlModule],
  providers: [OrganizerService],
  controllers: [OrganizerController]
})
export class OrganizerModule {}
