import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { UserRole, OrganizerStatus, EventOrganizerStatus, MemberStatus } from '@prisma/client';
import { GetOrganizersQueryDto, GetOrganizersQuerySchema, CreateOrganizerDto, CreateOrganizerSchema, UpdateOrganizerDto, UpdateOrganizerSchema, CreateRoleDto, CreateRoleSchema, UpdateRoleDto, UpdateRoleSchema, InviteMemberDto, InviteMemberSchema, UpdateMemberDto, UpdateMemberSchema } from './dto';

@Injectable()
export class OrganizerService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly uploadService: UploadService,
    ) { }

    async getAllOrganizers(user: any, query: GetOrganizersQueryDto) {
        try {
            const parsed = GetOrganizersQuerySchema.parse(query);
            const { search, status, isVerified, isPublic, sortBy, sortOrder, page, limit } = parsed;
            let whereClause: any = {};

            if (!user || user.role !== UserRole.ADMIN) {
                // Normal user logic
                whereClause = {
                    OR: [
                        { isPublic: true, status: OrganizerStatus.ACTIVE },
                    ]
                };
                // If user is logged in, show their own organizers regardless of status/visibility
                if (user) {
                    whereClause.OR.push({ userId: user.id });
                    whereClause.OR.push({
                        organizerMembers: {
                            some: { userId: user.id, status: MemberStatus.ACTIVE }
                        }
                    });
                }
            }

            // Add extra filters from query
            const andConditions: any[] = [{ deletedAt: null }];

            if (Object.keys(whereClause).length > 0) {
                andConditions.push(whereClause);
            }

            if (search) {
                andConditions.push({ name: { contains: search, mode: 'insensitive' } });
            }

            if (status) {
                // Only admin or owner can filter by status, otherwise it's restricted to active for public
                if (user?.role === UserRole.ADMIN) {
                    andConditions.push({ status });
                }
            }

            if (isVerified !== undefined) {
                andConditions.push({ isVerified });
            }

            if (isPublic !== undefined) {
                // Only admin or owner can see non-public organizers, but we just filter the allowed set
                andConditions.push({ isPublic });
            }

            const finalWhere = { AND: andConditions };
            const skip = (page - 1) * limit;

            let orderByClause: any;
            if (sortBy === 'followers') {
                orderByClause = {
                    followers: {
                        _count: sortOrder,
                    },
                };
            } else {
                orderByClause = {
                    [sortBy]: sortOrder,
                };
            }

            const result = await this.prisma.$transaction([
                this.prisma.organizer.count({ where: finalWhere }),
                this.prisma.organizer.findMany({
                    where: finalWhere,
                    include: {
                        _count: {
                            select: { followers: true, eventOrganizers: true }
                        }
                    },
                    orderBy: orderByClause,
                    skip,
                    take: limit,
                })
            ]);

            const [total, organizers] = result;

            if (!organizers || organizers.length === 0) {
                throw new HttpException('No organizers found', HttpStatus.NOT_FOUND);
            }

            const paginatedResult = {
                data: organizers,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                }
            };

            return paginatedResult;
        } catch (error: any) {
            if (error instanceof HttpException) throw error;
            throw new HttpException(
                error?.message || 'Failed to retrieve organizers',
                HttpStatus.BAD_REQUEST
            );
        }
    }

    async createOrganizer(user: any, dto: CreateOrganizerDto) {
        const result = await this.prisma.$transaction(async (tx) => {
            const parsed = CreateOrganizerSchema.parse(dto);
            const { name, description, isPublic } = parsed;

            const organizer = await tx.organizer.create({
                data: {
                    name,
                    description,
                    isPublic,
                    userId: user.id,
                },
            });

            return organizer;
        });

        return result;
    }

    async getOrganizerDetail(user: any, uuid: string) {
        const result = await this.prisma.$transaction(async (tx) => {
            const organizer = await tx.organizer.findFirst({
                where: { uuid, deletedAt: null },
                include: {
                    user: { select: { uuid: true, firstName: true, lastName: true, username: true, profile: true } },
                    roles: { where: { deletedAt: null } },
                    organizerMembers: {
                        where: { deletedAt: null },
                        include: {
                            user: { select: { uuid: true, firstName: true, lastName: true, username: true, profile: true } },
                            role: true,
                        }
                    },
                    _count: { select: { followers: true, eventOrganizers: true } }
                }
            });

            if (!organizer) {
                throw new HttpException('Organizer not found', HttpStatus.NOT_FOUND);
            }

            // Visibility: non-public only visible to owner, member, or admin
            if (!organizer.isPublic) {
                if (!user) throw new HttpException('Organizer not found', HttpStatus.NOT_FOUND);
                const isOwner = organizer.userId === user.id;
                const isAdmin = user.role === UserRole.ADMIN;
                const isMember = organizer.organizerMembers.some(om => om.userId === user.id && om.status === MemberStatus.ACTIVE);
                if (!isOwner && !isAdmin && !isMember) {
                    throw new HttpException('Organizer not found', HttpStatus.NOT_FOUND);
                }
            }

            return organizer;
        });

        return result;
    }

    async getOrganizersByEvent(user: any, eventUuid: string) {
        const result = await this.prisma.$transaction(async (tx) => {
            // Find event
            const event = await tx.event.findFirst({
                where: { uuid: eventUuid, deletedAt: null },
                include: {
                    eventOrganizers: {
                        include: { organizer: { include: { organizerMembers: true } } }
                    }
                }
            });

            if (!event) {
                throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
            }

            // Check if user is affiliated to determine what statuses to show
            let isAffiliated = false;
            if (user) {
                if (user.role === UserRole.ADMIN || event.userId === user.id) {
                    isAffiliated = true;
                } else {
                    isAffiliated = event.eventOrganizers.some(eo =>
                        eo.organizer.organizerMembers.some(om => om.userId === user.id && om.status === MemberStatus.ACTIVE)
                    );
                }
            }

            const eventOrganizers = await tx.eventOrganizer.findMany({
                where: {
                    eventId: event.id,
                    deletedAt: null,
                    // Non-affiliated users only see ACCEPTED organizers
                    ...(!isAffiliated ? { status: EventOrganizerStatus.ACCEPTED } : {}),
                },
                include: {
                    organizer: {
                        select: {
                            uuid: true,
                            name: true,
                            logo: true,
                            description: true,
                            isVerified: true,
                        }
                    },
                    eventOrganizerDetails: {
                        include: { role: true }
                    }
                }
            });

            return eventOrganizers;
        });

        return result;
    }

    // ─── ROLE MANAGEMENT ─────────────────────────────────────────────────────

    private async assertOrganizerOwnerOrAdmin(tx: any, organizerUuid: string, user: any) {
        const organizer = await tx.organizer.findFirst({
            where: { uuid: organizerUuid, deletedAt: null }
        });
        if (!organizer) throw new HttpException('Organizer not found', HttpStatus.NOT_FOUND);
        if (user.role !== UserRole.ADMIN && organizer.userId !== user.id) {
            throw new HttpException('Forbidden: only organizer owner or admin', HttpStatus.FORBIDDEN);
        }
        return organizer;
    }

    async createRole(user: any, organizerUuid: string, dto: CreateRoleDto) {
        const result = await this.prisma.$transaction(async (tx) => {
            const organizer = await this.assertOrganizerOwnerOrAdmin(tx, organizerUuid, user);
            const parsed = CreateRoleSchema.parse(dto);

            const role = await tx.role.create({
                data: {
                    name: parsed.name,
                    description: parsed.description,
                    organizerId: organizer.id,
                }
            });

            return role;
        });
        return result;
    }

    async updateRole(user: any, organizerUuid: string, roleUuid: string, dto: UpdateRoleDto) {
        const result = await this.prisma.$transaction(async (tx) => {
            const organizer = await this.assertOrganizerOwnerOrAdmin(tx, organizerUuid, user);
            const parsed = UpdateRoleSchema.parse(dto);

            const role = await tx.role.findFirst({
                where: { uuid: roleUuid, organizerId: organizer.id, deletedAt: null }
            });
            if (!role) throw new HttpException('Role not found', HttpStatus.NOT_FOUND);

            const updated = await tx.role.update({
                where: { id: role.id },
                data: { ...parsed }
            });

            return updated;
        });
        return result;
    }

    async deleteRole(user: any, organizerUuid: string, roleUuid: string) {
        const result = await this.prisma.$transaction(async (tx) => {
            const organizer = await this.assertOrganizerOwnerOrAdmin(tx, organizerUuid, user);

            const role = await tx.role.findFirst({
                where: { uuid: roleUuid, organizerId: organizer.id, deletedAt: null }
            });
            if (!role) throw new HttpException('Role not found', HttpStatus.NOT_FOUND);

            await tx.role.update({
                where: { id: role.id },
                data: { deletedAt: new Date() }
            });

            return { message: 'Role deleted successfully' };
        });
        return result;
    }

    // ─── MEMBER MANAGEMENT ───────────────────────────────────────────────────

    async inviteMember(user: any, organizerUuid: string, dto: InviteMemberDto) {
        const result = await this.prisma.$transaction(async (tx) => {
            const organizer = await this.assertOrganizerOwnerOrAdmin(tx, organizerUuid, user);
            const parsed = InviteMemberSchema.parse(dto);

            const targetUser = await tx.user.findFirst({
                where: { uuid: parsed.userUuid, deletedAt: null }
            });
            if (!targetUser) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

            // Check if already a member (any status)
            const existing = await tx.organizerMember.findFirst({
                where: { organizerId: organizer.id, userId: targetUser.id, deletedAt: null }
            });
            if (existing) {
                throw new HttpException(`User is already ${existing.status.toLowerCase()} in this organizer`, HttpStatus.BAD_REQUEST);
            }

            let roleId: number | undefined = undefined;
            if (parsed.roleUuid) {
                const role = await tx.role.findFirst({
                    where: { uuid: parsed.roleUuid, organizerId: organizer.id, deletedAt: null }
                });
                if (!role) throw new HttpException('Role not found or does not belong to this organizer', HttpStatus.NOT_FOUND);
                roleId = role.id;
            }

            const member = await tx.organizerMember.create({
                data: {
                    organizerId: organizer.id,
                    userId: targetUser.id,
                    roleId: roleId ?? null,
                    status: MemberStatus.PENDING,
                },
                include: {
                    user: { select: { uuid: true, firstName: true, lastName: true, username: true, profile: true } },
                    role: true,
                }
            });

            return member;
        });
        return result;
    }

    async updateMember(user: any, organizerUuid: string, memberUuid: string, dto: UpdateMemberDto) {
        const result = await this.prisma.$transaction(async (tx) => {
            const organizer = await this.assertOrganizerOwnerOrAdmin(tx, organizerUuid, user);
            const parsed = UpdateMemberSchema.parse(dto);

            const member = await tx.organizerMember.findFirst({
                where: { uuid: memberUuid, organizerId: organizer.id, deletedAt: null }
            });
            if (!member) throw new HttpException('Member not found', HttpStatus.NOT_FOUND);

            const dataToUpdate: any = {};

            if (parsed.status) {
                dataToUpdate.status = parsed.status;
                if (parsed.reason) dataToUpdate.reason = parsed.reason;
            }

            if (parsed.roleUuid) {
                const role = await tx.role.findFirst({
                    where: { uuid: parsed.roleUuid, organizerId: organizer.id, deletedAt: null }
                });
                if (!role) throw new HttpException('Role not found or does not belong to this organizer', HttpStatus.NOT_FOUND);
                dataToUpdate.roleId = role.id;
            }

            const updated = await tx.organizerMember.update({
                where: { id: member.id },
                data: dataToUpdate,
                include: {
                    user: { select: { uuid: true, firstName: true, lastName: true, username: true, profile: true } },
                    role: true,
                }
            });

            return updated;
        });
        return result;
    }

    async removeMember(user: any, organizerUuid: string, memberUuid: string) {
        const result = await this.prisma.$transaction(async (tx) => {
            const organizer = await this.assertOrganizerOwnerOrAdmin(tx, organizerUuid, user);

            const member = await tx.organizerMember.findFirst({
                where: { uuid: memberUuid, organizerId: organizer.id, deletedAt: null }
            });
            if (!member) throw new HttpException('Member not found', HttpStatus.NOT_FOUND);

            await tx.organizerMember.update({
                where: { id: member.id },
                data: { deletedAt: new Date() }
            });

            return { message: 'Member removed successfully' };
        });
        return result;
    }

    // ─── UPDATE / DELETE ORGANIZER ───────────────────────────────────────────

    async updateOrganizer(user: any, organizerUuid: string, dto: UpdateOrganizerDto) {
        const result = await this.prisma.$transaction(async (tx) => {
            const organizer = await this.assertOrganizerOwnerOrAdmin(tx, organizerUuid, user);
            const parsed = UpdateOrganizerSchema.parse(dto);

            // Non-admin cannot change status (only admin can verify/ban)
            if (parsed.status && user.role !== UserRole.ADMIN) {
                throw new HttpException('Only admin can change organizer status', HttpStatus.FORBIDDEN);
            }

            const updated = await tx.organizer.update({
                where: { id: organizer.id },
                data: { ...parsed },
            });

            return updated;
        });
        return result;
    }

    async uploadLogo(user: any, organizerUuid: string, file: Express.Multer.File) {
        const result = await this.prisma.$transaction(async (tx) => {
            const organizer = await this.assertOrganizerOwnerOrAdmin(tx, organizerUuid, user);

            const logoUrl = await this.uploadService.saveImage(file, 'logo', organizer.uuid);

            const updated = await tx.organizer.update({
                where: { id: organizer.id },
                data: { logo: logoUrl },
            });

            return updated;
        });
        return result;
    }

    async deleteOrganizer(user: any, organizerUuid: string) {
        const result = await this.prisma.$transaction(async (tx) => {
            const organizer = await this.assertOrganizerOwnerOrAdmin(tx, organizerUuid, user);

            await tx.organizer.update({
                where: { id: organizer.id },
                data: { deletedAt: new Date() },
            });

            return { message: 'Organizer deleted successfully' };
        });
        return result;
    }

    async followOrganizer(organizerUuid: string, currentUser: any) {
        const result = await this.prisma.$transaction(async (tx) => {
            const organizer = await tx.organizer.findUnique({ where: { uuid: organizerUuid } });
            if (!organizer) throw new HttpException('Organizer not found', HttpStatus.NOT_FOUND);

            const existingFollow = await tx.followOrganizer.findFirst({
                where: {
                    userId: currentUser.id,
                    organizerId: organizer.id,
                }
            });

            if (existingFollow) {
                return { message: 'Already following this organizer' };
            }

            await tx.followOrganizer.create({
                data: {
                    userId: currentUser.id,
                    organizerId: organizer.id,
                }
            });

            return { message: 'Successfully followed organizer' };
        });

        return result;
    }

    async unfollowOrganizer(organizerUuid: string, currentUser: any) {
        const result = await this.prisma.$transaction(async (tx) => {
            const organizer = await tx.organizer.findUnique({ where: { uuid: organizerUuid } });
            if (!organizer) throw new HttpException('Organizer not found', HttpStatus.NOT_FOUND);

            const existingFollow = await tx.followOrganizer.findFirst({
                where: {
                    userId: currentUser.id,
                    organizerId: organizer.id,
                }
            });

            if (!existingFollow) {
                return { message: 'You are not following this organizer' };
            }

            await tx.followOrganizer.delete({
                where: { id: existingFollow.id },
            });

            return { message: 'Successfully unfollowed organizer' };
        });

        return result;
    }

    async verifyOrganizer(uuid: string, isVerified: boolean) {
        const result = await this.prisma.$transaction(async (tx) => {
            const organizer = await tx.organizer.findUnique({ where: { uuid } });
            if (!organizer) throw new HttpException('Organizer not found', HttpStatus.NOT_FOUND);

            const updatedOrganizer = await tx.organizer.update({
                where: { id: organizer.id },
                data: { isVerified },
            });

            return updatedOrganizer;
        });

        return result;
    }
}
