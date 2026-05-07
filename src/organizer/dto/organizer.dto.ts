import { IsOptional, IsString, IsEnum, IsBoolean, IsInt, Min, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { z } from 'zod';
import { OrganizerStatus, MemberStatus } from '@prisma/client';

export enum SortOrder {
    ASC = 'asc',
    DESC = 'desc',
}

export enum OrganizerSortBy {
    NAME = 'name',
    CREATED_AT = 'createdAt',
    FOLLOWERS = 'followers',
}

export const GetOrganizersQuerySchema = z.object({
    search: z.string().optional(),
    status: z.nativeEnum(OrganizerStatus).optional(),
    isVerified: z.coerce.boolean().optional(),
    isPublic: z.coerce.boolean().optional(),
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(100).optional().default(10),
    sortBy: z.nativeEnum(OrganizerSortBy).optional().default(OrganizerSortBy.CREATED_AT),
    sortOrder: z.nativeEnum(SortOrder).optional().default(SortOrder.DESC),
});

export class GetOrganizersQueryDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(OrganizerStatus)
    status?: OrganizerStatus;

    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    isVerified?: boolean;

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
    @IsEnum(OrganizerSortBy)
    sortBy?: OrganizerSortBy = OrganizerSortBy.CREATED_AT;

    @IsOptional()
    @IsEnum(SortOrder)
    sortOrder?: SortOrder = SortOrder.DESC;
}

export const CreateOrganizerSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    isPublic: z.boolean().optional().default(true),
});

export class CreateOrganizerDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    isPublic?: boolean;
}

export const UpdateOrganizerSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    isPublic: z.boolean().optional(),
    status: z.nativeEnum(OrganizerStatus).optional(),
});

export class UpdateOrganizerDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    isPublic?: boolean;

    @IsOptional()
    @IsEnum(OrganizerStatus)
    status?: OrganizerStatus;
}

export const CreateRoleSchema = z.object({
    name: z.string().min(1, 'Role name is required'),
    description: z.string().optional(),
});

export class CreateRoleDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;
}

export const UpdateRoleSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
});

export class UpdateRoleDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;
}

export const InviteMemberSchema = z.object({
    userUuid: z.string().uuid('Invalid user UUID'),
    roleUuid: z.string().uuid().optional(),
});

export class InviteMemberDto {
    @IsNotEmpty()
    @IsString()
    userUuid: string;

    @IsOptional()
    @IsString()
    roleUuid?: string;
}

export const UpdateMemberSchema = z.object({
    roleUuid: z.string().uuid().optional(),
    status: z.nativeEnum(MemberStatus).optional(),
    reason: z.string().optional(),
});

export class UpdateMemberDto {
    @IsOptional()
    @IsString()
    roleUuid?: string;

    @IsOptional()
    @IsEnum(MemberStatus)
    status?: MemberStatus;

    @IsOptional()
    @IsString()
    reason?: string;
}

export const VerifyOrganizerSchema = z.object({
    isVerified: z.boolean(),
});

export class VerifyOrganizerDto {
    @Type(() => Boolean)
    @IsBoolean()
    isVerified: boolean;
}
