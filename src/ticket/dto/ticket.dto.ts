import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TicketStatus, PaymentStatus } from '@prisma/client';
import { z } from 'zod';

export enum UserTicketSortBy {
  CREATED_AT = 'createdAt',
  CODE = 'code',
  STATUS = 'status',
  PAYMENT_STATUS = 'paymentStatus',
  PAID_AT = 'paidAt',
  EVENT_TITLE = 'eventTitle',
  EVENT_START = 'eventStart',
}

export enum UserTicketGroupBy {
  STATUS = 'status',
  PAYMENT_STATUS = 'paymentStatus',
  EVENT_TITLE = 'eventTitle',
}

export const GetUserTicketsQuerySchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  sortBy: z.nativeEnum(UserTicketSortBy).optional().default(UserTicketSortBy.CREATED_AT),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  groupBy: z.nativeEnum(UserTicketGroupBy).optional(),
});

export class GetUserTicketsQueryDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(UserTicketSortBy)
  sortBy?: UserTicketSortBy = UserTicketSortBy.CREATED_AT;

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsEnum(UserTicketGroupBy)
  groupBy?: UserTicketGroupBy;
}

export const CreateTicketTierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  price: z.coerce.number().min(0, 'Price must be at least 0'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  startSale: z.coerce.date(),
  endSale: z.coerce.date(),
  description: z.string().optional(),
}).refine((data) => data.endSale > data.startSale, {
  message: 'endSale must be after startSale',
  path: ['endSale'],
});

export const UpdateTicketTierSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  price: z.coerce.number().min(0, 'Price must be at least 0').optional(),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').optional(),
  startSale: z.coerce.date().optional(),
  endSale: z.coerce.date().optional(),
  description: z.string().optional(),
}).refine((data) => {
  if (!data.startSale || !data.endSale) {
    return true;
  }

  return data.endSale > data.startSale;
}, {
  message: 'endSale must be after startSale',
  path: ['endSale'],
});

export class CreateTicketTierDto {
  @IsString()
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Date)
  @IsDate()
  startSale!: Date;

  @Type(() => Date)
  @IsDate()
  endSale!: Date;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateTicketTierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startSale?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endSale?: Date;

  @IsOptional()
  @IsString()
  description?: string;
}
