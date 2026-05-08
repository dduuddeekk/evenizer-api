import { IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export enum DeviceType {
  WEB = 'web',
  MOBILE = 'mobile',
}

export const LoginSchema = z.object({
  identifier: z.string().min(1, 'Identifier is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  device: z.nativeEnum(DeviceType).optional().default(DeviceType.WEB),
});

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsString()
  identifier: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: DeviceType, default: DeviceType.WEB })
  @IsEnum(DeviceType)
  @IsOptional()
  device?: DeviceType = DeviceType.WEB;
}

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOi...' })
  @IsString()
  refreshToken: string;
}

