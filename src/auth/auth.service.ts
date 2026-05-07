import { Injectable, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import * as argon from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { LoginDto, DeviceType, RefreshTokenDto } from './dto';
import { PrismaService } from '../prisma/prisma.service';
import { TokenType, UserStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) { }

  async login(dto: LoginDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: {
          OR: [
            { email: dto.identifier },
            { username: dto.identifier }
          ]
        },
      });

      if (!user) {
        throw new HttpException('Invalid email or password', HttpStatus.UNAUTHORIZED);
      }

      if (user.deletedAt !== null || user.status === UserStatus.BANNED) {
        throw new HttpException('Account is banned or deleted', HttpStatus.UNAUTHORIZED);
      }

      const isPasswordValid = await argon.verify(user.password, dto.password);
      if (!isPasswordValid) {
        throw new HttpException('Invalid email or password', HttpStatus.UNAUTHORIZED);
      }

      const isMobile = dto.device === DeviceType.MOBILE;
      const payload = { sub: user.uuid };

      if (isMobile) {
        // Mobile: 1 Token (Access Token), 1 Year
        const expiresInSeconds = 365 * 24 * 60 * 60;
        const accessToken = this.jwtService.sign(payload, { expiresIn: expiresInSeconds });

        await tx.token.create({
          data: {
            token: accessToken,
            type: TokenType.ACCESS,
            expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
            userId: user.id,
          },
        });

        const { password, id, ...userWithoutPasswordAndId } = user;
        return { user: userWithoutPasswordAndId, accessToken };
      } else {
        // Web: Access Token (short) + Refresh Token (long)
        const jwtExpiresSecond = parseInt(process.env.JWT_EXPIRES_SECOND || '120');
        const jwtExpiresDay = parseInt(process.env.JWT_EXPIRES_DAY || '30');

        const accessToken = this.jwtService.sign(payload, { expiresIn: jwtExpiresSecond });
        const refreshToken = this.jwtService.sign(payload, { expiresIn: jwtExpiresDay * 24 * 60 * 60 });

        await tx.token.create({
          data: {
            token: accessToken,
            type: TokenType.ACCESS,
            expiresAt: new Date(Date.now() + jwtExpiresSecond * 1000),
            userId: user.id,
          },
        });

        await tx.token.create({
          data: {
            token: refreshToken,
            type: TokenType.REFRESH,
            expiresAt: new Date(Date.now() + jwtExpiresDay * 24 * 60 * 60 * 1000),
            userId: user.id,
          },
        });

        const { password, id, ...userWithoutPasswordAndId } = user;
        return { user: userWithoutPasswordAndId, accessToken, refreshToken };
      }
    });

    return result;
  }

  async logout(token: string) {
    // Perform an atomic soft-delete update if the token exists and isn't deleted
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.token.updateMany({
        where: { token, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      return { message: 'Logged out successfully' };
    });

    return result;
  }

  async refresh(dto: RefreshTokenDto) {
    // 1. Verify JWT signature first before querying DB
    try {
      this.jwtService.verify(dto.refreshToken);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token signature');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 2. Verify if refresh token is in DB and active
      const existingToken = await tx.token.findFirst({
        where: {
          token: dto.refreshToken,
          type: TokenType.REFRESH,
          deletedAt: null
        },
      });

      if (!existingToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (new Date() > existingToken.expiresAt) {
        throw new UnauthorizedException('Refresh token expired');
      }

      // 3. Generate new Access Token
      const user = await tx.user.findUnique({ where: { id: existingToken.userId } });
      if (!user) throw new UnauthorizedException('User not found');

      if (user.deletedAt !== null || user.status === UserStatus.BANNED) {
        throw new UnauthorizedException('Account is banned or deleted');
      }

      const payload = { sub: user.uuid };
      const jwtExpiresSecond = parseInt(process.env.JWT_EXPIRES_SECOND || '120');
      const newAccessToken = this.jwtService.sign(payload, { expiresIn: jwtExpiresSecond });

      // 4. Save new access token to DB
      await tx.token.create({
        data: {
          token: newAccessToken,
          type: TokenType.ACCESS,
          expiresAt: new Date(Date.now() + jwtExpiresSecond * 1000),
          userId: user.id,
        },
      });

      return { accessToken: newAccessToken };
    });

    return result;
  }
}
