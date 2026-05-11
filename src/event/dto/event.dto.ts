import { IsOptional, IsString, IsEnum, IsBoolean, IsInt, Min, IsDate, IsArray, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import { EventStatus, RundownStatus, RundownVisibility, EventOrganizerStatus, EventLocationType } from '@prisma/client';

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
  description: z.string().optional(),
  categories: z.array(z.string()).optional(),
  locations: z.array(z.object({
    type: z.nativeEnum(EventLocationType),
    location: z.string().min(1),
  })).optional(),
});

export class EventLocationDto {
  @ApiProperty({ enum: EventLocationType })
  @IsEnum(EventLocationType)
  type!: EventLocationType;

  @ApiProperty({ example: 'Main Hall' })
  @IsString()
  location!: string;
}

export class CreateEventDto {
  @ApiProperty({ example: 'Spring Festival' })
  @IsString()
  title!: string;

  @ApiProperty({ type: String, example: '2026-05-10T08:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  start!: Date;

  @ApiProperty({ type: String, example: '2026-05-10T10:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  end!: Date;

  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;


  @ApiPropertyOptional({ example: 'Event description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['music', 'festival'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ type: [EventLocationDto] })
  @IsOptional()
  @IsArray()
  locations?: EventLocationDto[];
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
  @ApiPropertyOptional({ example: 'Spring Festival' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ type: String, example: '2026-05-10T08:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  start?: Date;

  @ApiPropertyOptional({ type: String, example: '2026-05-10T10:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  end?: Date;

  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ example: 'https://example.com/banner.jpg' })
  @IsOptional()
  @IsString()
  banner?: string;

  @ApiPropertyOptional({ example: 'Event description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['music', 'festival'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ type: [String], example: ['organizer-uuid-1', 'organizer-uuid-2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  organizerUuids?: string[];

  @ApiPropertyOptional({ type: [EventLocationDto] })
  @IsOptional()
  @IsArray()
  locations?: EventLocationDto[];
}

export class CreateRundownDto {
  @ApiProperty({ example: 'Opening Ceremony' })
  @IsString()
  title!: string;

  @ApiProperty({ type: String, example: '2026-05-10T08:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  date!: Date;

  @ApiProperty({ type: String, example: '2026-05-10T08:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  start!: Date;

  @ApiProperty({ type: String, example: '2026-05-10T09:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  end!: Date;

  @ApiPropertyOptional({ enum: RundownStatus })
  @IsOptional()
  @IsEnum(RundownStatus)
  status?: RundownStatus;

  @ApiPropertyOptional({ enum: RundownVisibility })
  @IsOptional()
  @IsEnum(RundownVisibility)
  visibility?: RundownVisibility;

  @ApiPropertyOptional({ example: 'Run of show details' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'event-location-uuid', nullable: true })
  @IsOptional()
  @IsString()
  locationUuid?: string;
}

export class UpdateRundownDto {
  @ApiPropertyOptional({ example: 'Opening Ceremony' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ type: String, example: '2026-05-10T08:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date?: Date;

  @ApiPropertyOptional({ type: String, example: '2026-05-10T08:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  start?: Date;

  @ApiPropertyOptional({ type: String, example: '2026-05-10T09:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  end?: Date;

  @ApiPropertyOptional({ enum: RundownStatus })
  @IsOptional()
  @IsEnum(RundownStatus)
  status?: RundownStatus;

  @ApiPropertyOptional({ enum: RundownVisibility })
  @IsOptional()
  @IsEnum(RundownVisibility)
  visibility?: RundownVisibility;

  @ApiPropertyOptional({ example: 'Run of show details' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'event-location-uuid', nullable: true })
  @IsOptional()
  @IsString()
  locationUuid?: string;
}

export class AddOrganizerToEventDto {
  @ApiProperty({ example: 'organizer-uuid-1' })
  @IsNotEmpty()
  @IsString()
  organizerUuid!: string;

  @ApiPropertyOptional({ type: [String], example: ['role-uuid-1', 'role-uuid-2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleUuids?: string[];
}