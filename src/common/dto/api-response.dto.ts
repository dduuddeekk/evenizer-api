import { IsBoolean, IsString, IsOptional } from 'class-validator';
import { z } from 'zod';
import { HttpStatus } from '@nestjs/common';

export const APIResponseSchema = z.object({
  success: z.boolean(),
  code: z.string(),
  message: z.string(),
  data: z.any().optional(),
});

export const ErrorResponseSchema = z.object({
  success: z.boolean(),
  code: z.string(),
  message: z.string(),
  error: z.any().optional(),
});

export class APIResponse<T = any> {
  @IsBoolean()
  success: boolean;

  @IsString()
  code: string;

  @IsString()
  message: string;

  @IsOptional()
  data?: T;

  constructor(status: HttpStatus, message: string, data?: T) {
    this.success = true;
    this.code = HttpStatus[status];
    this.message = message;
    if (data !== undefined) {
      this.data = data;
    }
  }
}

export class ErrorResponse {
  @IsBoolean()
  success: boolean;

  @IsString()
  code: string;

  @IsString()
  message: string;

  @IsOptional()
  error: any;

  constructor(status: HttpStatus, message: string, error: any) {
    this.success = false;
    this.code = HttpStatus[status]; // Mengambil teks otomatis, misal 404 -> "NOT_FOUND"
    this.message = message;
    this.error = error;
  }
}
