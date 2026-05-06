import { Injectable, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import * as argon from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { LoginDto, DeviceType, RefreshTokenDto } from './dto/index.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
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

      await this.prisma.token.create({
        data: {
          token: accessToken,
          type: 'ACCESS',
          expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
          userId: user.id,
        },
      });

      const { password, ...userWithoutPassword } = user;
      return { user: userWithoutPassword, accessToken };
    } else {
      // Web: Access Token (short) + Refresh Token (long)
      const jwtExpiresSecond = parseInt(process.env.JWT_EXPIRES_SECOND || '120');
      const jwtExpiresDay = parseInt(process.env.JWT_EXPIRES_DAY || '30');

      const accessToken = this.jwtService.sign(payload, { expiresIn: jwtExpiresSecond });
      const refreshToken = this.jwtService.sign(payload, { expiresIn: jwtExpiresDay * 24 * 60 * 60 });

      // Save Access Token
      await this.prisma.token.create({
        data: {
          token: accessToken,
          type: 'ACCESS',
          expiresAt: new Date(Date.now() + jwtExpiresSecond * 1000),
          userId: user.id,
        },
      });

      // Save Refresh Token
      await this.prisma.token.create({
        data: {
          token: refreshToken,
          type: 'REFRESH',
          expiresAt: new Date(Date.now() + jwtExpiresDay * 24 * 60 * 60 * 1000),
          userId: user.id,
        },
      });

      const { password, ...userWithoutPassword } = user;
      return { user: userWithoutPassword, accessToken, refreshToken };
    }
  }

  async logout(token: string) {
    const existingToken = await this.prisma.token.findFirst({
      where: { token, deletedAt: null },
    });

    if (existingToken) {
      // Soft Delete
      await this.prisma.token.update({
        where: { id: existingToken.id },
        data: { deletedAt: new Date() }
      });
    }

    return { message: 'Logged out successfully' };
  }

  async refresh(dto: RefreshTokenDto) {
    // 1. Verify if refresh token is in DB and active
    const existingToken = await this.prisma.token.findFirst({
      where: { 
        token: dto.refreshToken,
        type: 'REFRESH',
        deletedAt: null
      },
    });

    if (!existingToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date() > existingToken.expiresAt) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // 2. Verify JWT signature
    try {
      this.jwtService.verify(dto.refreshToken);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token signature');
    }

    // 3. Generate new Access Token
    const user = await this.prisma.user.findUnique({ where: { id: existingToken.userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const payload = { sub: user.uuid };
    const jwtExpiresSecond = parseInt(process.env.JWT_EXPIRES_SECOND || '120');
    const newAccessToken = this.jwtService.sign(payload, { expiresIn: jwtExpiresSecond });

    // 4. Save new access token to DB
    await this.prisma.token.create({
      data: {
        token: newAccessToken,
        type: 'ACCESS',
        expiresAt: new Date(Date.now() + jwtExpiresSecond * 1000),
        userId: user.id,
      },
    });

    return { accessToken: newAccessToken };
  }
}
