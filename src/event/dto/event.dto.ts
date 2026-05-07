import { IsOptional, IsString, IsEnum, IsBoolean, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { z } from 'zod';
import { EventStatus } from '@prisma/client';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum EventSortBy {
  TITLE = 'title',
  START = 'start',
  END = 'end',
  CREATED_AT = 'createdAt',
  FAVOURITED = 'favourited',
}

export enum EventGroupBy {
  STATUS = 'status',
  IS_PUBLIC = 'isPublic',
}

export const GetEventsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(EventStatus).optional(),
  isPublic: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  sortBy: z.nativeEnum(EventSortBy).optional().default(EventSortBy.CREATED_AT),
  sortOrder: z.nativeEnum(SortOrder).optional().default(SortOrder.DESC),
  groupBy: z.nativeEnum(EventGroupBy).optional(),
});

export class GetEventsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublic?: boolean;

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
  @IsEnum(EventSortBy)
  sortBy?: EventSortBy = EventSortBy.CREATED_AT;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @IsOptional()
  @IsEnum(EventGroupBy)
  groupBy?: EventGroupBy;
}