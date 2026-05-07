import { IsOptional, IsString, IsEnum, IsBoolean, IsInt, Min, IsDate, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { z } from 'zod';
import { EventStatus, RundownStatus, RundownVisibility } from '@prisma/client';

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
  category: z.string().optional(),
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
  @IsString()
  category?: string;

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

export const CreateEventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  start: z.coerce.date(),
  end: z.coerce.date(),
  status: z.nativeEnum(EventStatus).optional(),
  isPublic: z.boolean().optional(),
  banner: z.string().optional(),
  description: z.string().optional(),
  categories: z.array(z.string()).optional(),
});

export class CreateEventDto {
  @IsString()
  title: string;

  @Type(() => Date)
  @IsDate()
  start: Date;

  @Type(() => Date)
  @IsDate()
  end: Date;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  banner?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];
}

export enum RundownSortBy {
  DATE = 'date',
  START = 'start',
  END = 'end',
  CREATED_AT = 'createdAt',
  TITLE = 'title',
}

export enum RundownGroupBy {
  STATUS = 'status',
  VISIBILITY = 'visibility',
}

export const GetRundownsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(RundownStatus).optional(),
  visibility: z.nativeEnum(RundownVisibility).optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  sortBy: z.nativeEnum(RundownSortBy).optional().default(RundownSortBy.START),
  sortOrder: z.nativeEnum(SortOrder).optional().default(SortOrder.ASC),
  groupBy: z.nativeEnum(RundownGroupBy).optional(),
});

export class GetRundownsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(RundownStatus)
  status?: RundownStatus;

  @IsOptional()
  @IsEnum(RundownVisibility)
  visibility?: RundownVisibility;

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
  @IsEnum(RundownSortBy)
  sortBy?: RundownSortBy = RundownSortBy.START;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.ASC;

  @IsOptional()
  @IsEnum(RundownGroupBy)
  groupBy?: RundownGroupBy;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  start?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  end?: Date;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  banner?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  organizerUuids?: string[];
}

export class CreateRundownDto {
  @IsString()
  title: string;

  @Type(() => Date)
  @IsDate()
  date: Date;

  @Type(() => Date)
  @IsDate()
  start: Date;

  @Type(() => Date)
  @IsDate()
  end: Date;

  @IsOptional()
  @IsEnum(RundownStatus)
  status?: RundownStatus;

  @IsOptional()
  @IsEnum(RundownVisibility)
  visibility?: RundownVisibility;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateRundownDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  start?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  end?: Date;

  @IsOptional()
  @IsEnum(RundownStatus)
  status?: RundownStatus;

  @IsOptional()
  @IsEnum(RundownVisibility)
  visibility?: RundownVisibility;

  @IsOptional()
  @IsString()
  description?: string;
}