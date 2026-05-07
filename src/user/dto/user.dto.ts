import { IsEmail, IsString, MinLength, IsOptional, IsEnum, IsBoolean, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { z } from 'zod';
import { UserStatus, Gender, UserRole } from '@prisma/client';

export const RegisterSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export class RegisterDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

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
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  profile?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  birthdate?: Date;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export const UpdateUserAdminSchema = UpdateUserSchema.extend({
  email: z.string().email().optional(),
  isVerified: z.boolean().optional(),
});

export class UpdateUserAdminDto extends UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}
