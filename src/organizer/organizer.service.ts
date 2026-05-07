import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, OrganizerStatus, EventOrganizerStatus } from '@prisma/client';
import { GetOrganizersQueryDto, GetOrganizersQuerySchema, CreateOrganizerDto, CreateOrganizerSchema } from './dto';

@Injectable()
export class OrganizerService {
    constructor(private readonly prisma: PrismaService) { }

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
                            some: { userId: user.id }
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
                const isMember = organizer.organizerMembers.some(om => om.userId === user.id);
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
                        eo.organizer.organizerMembers.some(om => om.userId === user.id)
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
}
