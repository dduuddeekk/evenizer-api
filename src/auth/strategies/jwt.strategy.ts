import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private prisma = new PrismaClient();

  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'Acara-Lancar-5758-Pikiran-Tenang',
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    const rawToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    
    if (!rawToken) {
      throw new UnauthorizedException('Token not found');
    }

    // Cari user berdasarkan payload.sub (uuid)
    const user = await this.prisma.user.findFirst({
      where: { uuid: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Pastikan token masih aktif di database (belum dilogout)
    const tokenRecord = await this.prisma.token.findFirst({
      where: {
        token: rawToken,
        userId: user.id,
        type: 'ACCESS',
        deletedAt: null,
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Token invalid or expired');
    }

    return user; // Akan disuntikkan ke req.user
  }
}
