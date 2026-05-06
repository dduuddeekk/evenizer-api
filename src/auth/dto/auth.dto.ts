import { IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
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
  @IsString()
  identifier: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(DeviceType)
  @IsOptional()
  device?: DeviceType = DeviceType.WEB;
}

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

