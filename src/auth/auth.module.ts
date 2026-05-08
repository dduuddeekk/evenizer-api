import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { EmailModule } from '../email/email.module';
import { AuthController } from './auth.controller';
import { JwtStrategy } from '../common/strategies/';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'Acara-Lancar-5758-Pikiran-Tenang',
    }),
    // EmailModule removed from AuthModule; user-level endpoints handle email
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController]
})
export class AuthModule { }
