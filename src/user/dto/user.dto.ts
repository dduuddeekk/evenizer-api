import { IsEmail, IsString, MinLength, IsOptional, IsEnum, IsBoolean, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import { UserStatus, Gender, UserRole } from '@prisma/client';

export const RegisterSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export class RegisterDto {
  @ApiProperty({ example: 'Mina' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Gemini' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'mina@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  password: string;
}

export const UpdateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  profile: z.string().optional(),
  birthdate: z.coerce.date().optional(),
  bio: z.string().optional(),
  phoneNumber: z.string().optional(),
  gender: z.nativeEnum(Gender).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Mina' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Gemini' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 'mina123' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ example: 'https://example.com/profile.jpg' })
  @IsOptional()
  @IsString()
  profile?: string;

  @ApiPropertyOptional({ type: String, example: '2000-01-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  birthdate?: Date;

  @ApiPropertyOptional({ example: 'Short bio' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: '+628123456789' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export const UpdateUserAdminSchema = UpdateUserSchema.extend({
  email: z.string().email().optional(),
  isVerified: z.boolean().optional(),
});

export class UpdateUserAdminDto extends UpdateUserDto {
  @ApiPropertyOptional({ example: 'mina@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}

export const VerifyUserSchema = z.object({
  isVerified: z.boolean(),
});

export class VerifyUserDto {
  @ApiProperty({ example: true })
  @Type(() => Boolean)
  @IsBoolean()
  isVerified: boolean;
}
