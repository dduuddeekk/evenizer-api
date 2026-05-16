import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventStatus, UserRole, RundownVisibility, EventOrganizerStatus, MemberStatus } from '@prisma/client';
import { GetEventsQueryDto, CreateEventDto, GetRundownsQueryDto, UpdateEventDto, CreateRundownDto, UpdateRundownDto, AddOrganizerToEventDto, EventLocationDto } from './dto';
import { UploadService } from '../upload/upload.service';
import type { UploadedFile as UploadedFileData } from '../common/types';

@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  private buildEventLocationCreates(locations?: EventLocationDto[]) {
    if (!locations || locations.length === 0) {
      return undefined;
    }

    return {
      create: locations.map((item) => ({
        type: item.type,
        location: item.location,
      })),
    };
  }

  private async resolveRundownLocationId(tx: any, eventId: number, locationUuid?: string) {
    if (!locationUuid) {
      return null;
    }

    const location = await tx.eventLocation.findFirst({
      where: {
        uuid: locationUuid,
        eventId,
        deletedAt: null,
      },
    });

    if (!location) {
      throw new HttpException('Event location not found', HttpStatus.NOT_FOUND);
    }

    return location.id;
  }

  private normalizeUuidResponse(
    value: any,
    context: { parentUuid?: string; parentType?: string; rootEventUuid?: string } = {},
  ): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (value instanceof Date) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeUuidResponse(item, context));
    }

    if (typeof value !== 'object') {
      return value;
    }

    const normalized: any = {};
    const objectValue: any = value;

    if (objectValue.uuid !== undefined) {
      normalized.uuid = objectValue.uuid;
    }

    for (const [key, nestedValue] of Object.entries(objectValue)) {
      if (key === 'id') {
        continue;
      }

      if (key === 'user' && nestedValue && typeof nestedValue === 'object') {
        if ((nestedValue as any).uuid !== undefined) {
          normalized.userUuid = (nestedValue as any).uuid;
        }
        continue;
      }

      if (key.endsWith('Id')) {
        const baseKey = key.slice(0, -2);

        if (baseKey === 'event') {
          normalized.eventUuid = context.rootEventUuid ?? (context.parentType === 'event' ? context.parentUuid : objectValue.event?.uuid);
          continue;
        }

        if (baseKey === 'category') {
          normalized.categoryUuid = context.parentType === 'category' ? context.parentUuid : objectValue.category?.uuid;
          continue;
        }

        if (baseKey === 'eventOrganizer') {
          normalized.eventOrganizerUuid = context.parentType === 'eventOrganizer' ? context.parentUuid : objectValue.eventOrganizer?.uuid;
          continue;
        }

        if (baseKey === 'organizer') {
          normalized.organizerUuid = context.parentType === 'organizer' ? context.parentUuid : objectValue.organizer?.uuid;
          continue;
        }

        if (baseKey === 'role') {
          normalized.roleUuid = objectValue.role?.uuid;
          continue;
        }

        if (baseKey === 'ticketTier') {
          normalized.ticketTierUuid = objectValue.ticketTier?.uuid;
          continue;
        }

        if (baseKey === 'transaction') {
          normalized.transactionUuid = objectValue.transaction?.uuid;
          continue;
        }

        if (baseKey === 'following') {
          normalized.followingUuid = objectValue.following?.uuid;
          continue;
        }

        if (baseKey === 'follower') {
          normalized.followerUuid = objectValue.follower?.uuid;
          continue;
        }

        if (baseKey === 'location') {
          normalized.locationUuid = context.parentType === 'eventLocation' ? context.parentUuid : objectValue.location?.uuid;
          continue;
        }

        if (baseKey === 'user') {
          normalized.userUuid = objectValue.user?.uuid;
          continue;
        }

        continue;
      }

      if (nestedValue instanceof Date) {
        normalized[key] = nestedValue;
        continue;
      }

      if (Array.isArray(nestedValue)) {
        const childParentType = this.inferChildParentType(key, context.parentType);
        const childContext = {
          parentUuid: objectValue.uuid ?? context.parentUuid,
          parentType: childParentType ?? context.parentType,
          rootEventUuid: context.rootEventUuid ?? objectValue.uuid ?? context.parentUuid,
        };

        normalized[key] = nestedValue.map((item) => this.normalizeUuidResponse(item, childContext));
        continue;
      }

      if (nestedValue && typeof nestedValue === 'object') {
        const childParentType = this.inferChildParentType(key, context.parentType);
        const childContext = {
          parentUuid: objectValue.uuid ?? context.parentUuid,
          parentType: childParentType ?? context.parentType,
          rootEventUuid: context.rootEventUuid ?? objectValue.uuid ?? context.parentUuid,
        };

        normalized[key] = this.normalizeUuidResponse(nestedValue, childContext);
        continue;
      }

      normalized[key] = nestedValue;
    }

    if (normalized.uuid === undefined && objectValue.uuid !== undefined) {
      normalized.uuid = objectValue.uuid;
    }

    return normalized;
  }

  private detectParentType(value: any): string | undefined {
    if (value && typeof value === 'object') {
      if (Object.prototype.hasOwnProperty.call(value, 'title') && Object.prototype.hasOwnProperty.call(value, 'start') && Object.prototype.hasOwnProperty.call(value, 'end')) {
        return 'event';
      }

      if (Object.prototype.hasOwnProperty.call(value, 'type') && Object.prototype.hasOwnProperty.call(value, 'location')) {
        return 'eventLocation';
      }

      if (Object.prototype.hasOwnProperty.call(value, 'name') && Object.prototype.hasOwnProperty.call(value, 'categoryDetails')) {
        return 'category';
      }

      if (Object.prototype.hasOwnProperty.call(value, 'status') && Object.prototype.hasOwnProperty.call(value, 'eventOrganizerDetails')) {
        return 'eventOrganizer';
      }

      if (Object.prototype.hasOwnProperty.call(value, 'title') && Object.prototype.hasOwnProperty.call(value, 'date') && Object.prototype.hasOwnProperty.call(value, 'visibility')) {
        return 'rundown';
      }
    }

    return undefined;
  }

  private inferChildParentType(key: string, parentType?: string): string | undefined {
    if (key === 'categories' || key === 'eventLocations' || key === 'ticketTiers' || key === 'eventOrganizers') {
      return 'event';
    }

    if (key === 'categoryDetails') {
      return 'category';
    }

    if (key === 'eventOrganizerDetails') {
      return 'eventOrganizer';
    }

    if (key === 'organizerMembers') {
      return 'organizer';
    }

    if (key === 'location') {
      return 'rundown';
    }

    return parentType;
  }

  async getAllEvents(user: any, query: GetEventsQueryDto) {
    try {
      const { search, category, status, isPublic, sortBy = 'createdAt', sortOrder = 'desc', groupBy } = query;
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      
      // Base condition: only show public events that are not DRAFT
      const andConditions: any[] = [
        {
          isPublic: true,
          deletedAt: null,
          status: {
            not: EventStatus.DRAFT,
          },
        },
      ];

      // Add additional query filters if provided

      if (search) {
        andConditions.push({ title: { contains: search } });
      }

      if (category) {
        andConditions.push({
          categories: {
            some: {
              categoryDetails: {
                some: {
                  name: {
                    equals: category
                  }
                }
              }
            }
          }
        });
      }
      
      if (status) {
        andConditions.push({ status });
      }

      if (isPublic !== undefined) {
        andConditions.push({ isPublic });
      }

      const finalWhere = { AND: andConditions };

      // If groupBy is requested, return grouped stats instead of paginated events
      if (groupBy) {
        const result = await this.prisma.$transaction(async (tx) => {
          const groupedEvents = await tx.event.groupBy({
            by: [groupBy as any],
            where: finalWhere,
            _count: {
              id: true,
            },
          });
          
          if (!groupedEvents || groupedEvents.length === 0) {
            throw new HttpException('No events found', HttpStatus.NOT_FOUND);
          }

          return {
            data: groupedEvents,
            meta: { groupBy }
          };
        });

        return result;
      }

      // Normal paginated response
      const skip = (page - 1) * limit;

      let orderByClause: any = {};
      if (sortBy === 'favourited') {
        orderByClause = {
          favouritedBy: {
            _count: sortOrder,
          },
        };
      } else {
        orderByClause = {
          [sortBy]: sortOrder,
        };
      }

      const result = await this.prisma.$transaction([
        this.prisma.event.count({ where: finalWhere }),
        this.prisma.event.findMany({
          where: finalWhere,
          include: {
            user: {
              select: { uuid: true }
            },
            categories: {
              include: {
                categoryDetails: true
              }
            },
            eventLocations: true,
            ticketTiers: true,
            _count: {
              select: { favouritedBy: true }
            }
          },
          orderBy: orderByClause,
          skip,
          take: limit,
        })
      ]);

      const [total, events] = result;
      const normalizedEvents = events.map((event) =>
        this.normalizeUuidResponse(event, { parentType: 'event', rootEventUuid: event.uuid }),
      );

      let favouritedEventIds = new Set<number>();

      if (user?.id && events.length > 0) {
        const favouriteEvents = await this.prisma.favouriteEvent.findMany({
          where: {
            userId: user.id,
            deletedAt: null,
            eventId: {
              in: events.map((event) => event.id),
            },
          },
          select: {
            eventId: true,
          },
        });

        favouritedEventIds = new Set(favouriteEvents.map((favourite) => favourite.eventId));
      }

      const eventsWithFavouriteStatus = normalizedEvents.map((event, index) => ({
        ...event,
        isFavorited: favouritedEventIds.has(events[index].id),
      }));

      const paginatedResult = {
        data: eventsWithFavouriteStatus,
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
        error?.message || 'Failed to retrieve public events',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getMyEvents(user: any, query: GetEventsQueryDto) {
    try {
      if (!user || !user.uuid) {
        throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      }

      // Find the user by uuid from token payload
      const currentUser = await this.prisma.user.findFirst({
        where: { uuid: user.uuid },
        select: { id: true }
      });

      if (!currentUser) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      const { search, category, status, isPublic, sortBy = 'createdAt', sortOrder = 'desc', groupBy } = query;
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;

      // Build where clause for user's events
      const andConditions: any[] = [
        { userId: currentUser.id, deletedAt: null }
      ];

      if (search) {
        andConditions.push({ title: { contains: search } });
      }

      if (category) {
        andConditions.push({
          categories: {
            some: {
              categoryDetails: {
                some: {
                  name: {
                    equals: category
                  }
                }
              }
            }
          }
        });
      }

      if (status) {
        andConditions.push({ status });
      }

      if (isPublic !== undefined) {
        andConditions.push({ isPublic });
      }

      const finalWhere = { AND: andConditions };

      // If groupBy is requested, return grouped stats instead of paginated events
      if (groupBy) {
        const groupedEvents = await this.prisma.event.groupBy({
          by: [groupBy as any],
          where: finalWhere,
          _count: {
            id: true,
          },
        });

        if (!groupedEvents || groupedEvents.length === 0) {
          throw new HttpException('No events found', HttpStatus.NOT_FOUND);
        }

        return {
          data: groupedEvents,
          meta: { groupBy }
        };
      }

      // Normal paginated response
      const skip = (page - 1) * limit;

      let orderByClause: any = {};
      if (sortBy === 'favourited') {
        orderByClause = {
          favouritedBy: {
            _count: sortOrder,
          },
        };
      } else {
        orderByClause = {
          [sortBy]: sortOrder,
        };
      }

      const result = await this.prisma.$transaction([
        this.prisma.event.count({ where: finalWhere }),
        this.prisma.event.findMany({
          where: finalWhere,
          include: {
            user: {
              select: { uuid: true }
            },
            categories: {
              include: {
                categoryDetails: true
              }
            },
            eventLocations: true,
            ticketTiers: true,
            _count: {
              select: { favouritedBy: true }
            }
          },
          orderBy: orderByClause,
          skip,
          take: limit,
        })
      ]);

      const [total, events] = result;
      const normalizedEvents = events.map((event) =>
        this.normalizeUuidResponse(event, { parentType: 'event', rootEventUuid: event.uuid }),
      );

      if (!normalizedEvents || normalizedEvents.length === 0) {
        throw new HttpException('No events found', HttpStatus.NOT_FOUND);
      }

      const paginatedResult = {
        data: normalizedEvents,
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
        error?.message || 'Failed to retrieve your events',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getEventsByOrganizer(user: any, organizerUuid: string, query: GetEventsQueryDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Verify organizer exists and user has permission
      const organizer = await tx.organizer.findFirst({
        where: { uuid: organizerUuid, deletedAt: null },
        include: { organizerMembers: true }
      });

      if (!organizer) {
        throw new HttpException('Organizer not found', HttpStatus.NOT_FOUND);
      }

      let hasPermission = false;
      if (user.role === UserRole.ADMIN || organizer.userId === user.id) {
        hasPermission = true;
      } else {
        const isMember = organizer.organizerMembers.some(om => om.userId === user.id);
        if (isMember) hasPermission = true;
      }

      if (!hasPermission) {
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      }

      // 2. Fetch all events connected to this organizer via EventOrganizer
      const { search, category, status, isPublic, sortBy = 'createdAt', sortOrder = 'desc', groupBy } = query;
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      
      const andConditions: any[] = [
        {
          deletedAt: null,
          eventOrganizers: {
            some: { organizerId: organizer.id }
          }
        }
      ];

      if (search) {
        andConditions.push({ title: { contains: search } });
      }

      if (status) {
        andConditions.push({ status });
      }

      if (isPublic !== undefined) {
        andConditions.push({ isPublic });
      }

      if (category) {
        andConditions.push({
          categories: {
            some: {
              categoryDetails: {
                some: { name: { contains: category } }
              }
            }
          }
        });
      }

      const finalWhere = { AND: andConditions };

      if (groupBy) {
        const groupedEvents = await tx.event.groupBy({
          by: [groupBy as any],
          where: finalWhere,
          _count: { id: true },
        });

        if (!groupedEvents || groupedEvents.length === 0) {
          throw new HttpException('No events found', HttpStatus.NOT_FOUND);
        }

        return { data: groupedEvents, meta: { groupBy } };
      }

      const skip = (page - 1) * limit;
      let orderByClause: any;

      if (sortBy === 'favourited') {
        orderByClause = { favouritedBy: { _count: sortOrder } };
      } else {
        orderByClause = { [sortBy]: sortOrder };
      }

      const [total, events] = await Promise.all([
        tx.event.count({ where: finalWhere }),
        tx.event.findMany({
          where: finalWhere,
          include: {
            user: {
              select: { uuid: true }
            },
            categories: { include: { categoryDetails: true } },
            eventLocations: true,
            ticketTiers: true,
            _count: { select: { favouritedBy: true } }
          },
          orderBy: orderByClause,
          skip,
          take: limit,
        })
      ]);

      const normalizedEvents = events.map((event) =>
        this.normalizeUuidResponse(event, { parentType: 'event', rootEventUuid: event.uuid }),
      );

      return {
        data: normalizedEvents,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        }
      };
    });

    return result;
  }

  async createEvent(user: any, dto: CreateEventDto) {
    try {
      if (!user || !user.id) {
        throw new HttpException('Unauthorized - User not found in token', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const { title, start, end, status, isPublic, description, categories, locations } = dto;

        // Construct category nested creation logic if categories are provided
        let categoriesData: any = undefined;
        if (categories && categories.length > 0) {
          categoriesData = {
            create: categories.map(tag => ({
              categoryDetails: {
                create: {
                  name: tag.toLowerCase()
                }
              }
            }))
          };
        }

        // 1) create event without banner first
        let event = await tx.event.create({
          data: {
            title,
            start,
            end,
            status: status || EventStatus.DRAFT,
            isPublic: isPublic || false,
            banner: null,
            description,
            userId: user.id, // Linked to the authenticated user
            categories: categoriesData,
            eventLocations: this.buildEventLocationCreates(locations)
          },
          include: {
            user: {
              select: { uuid: true }
            },
            categories: {
              include: {
                categoryDetails: true
              }
            },
            eventLocations: true,
            ticketTiers: true,
          }
        });

        // Banner should be uploaded via PATCH /event/:uuid/banner
        return this.normalizeUuidResponse(event, { parentType: 'event', rootEventUuid: event.uuid });
      });

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error?.message || 'Failed to create event - please check your input',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getEventDetail(user: any, uuid: string) {
    try {
      if (!uuid) {
        throw new HttpException('Event UUID is required', HttpStatus.BAD_REQUEST);
      }

      const result = await this.prisma.$transaction(async (tx) => {
        let whereClause: any = { uuid };

        if (!user || user.role !== UserRole.ADMIN) {
        whereClause = {
          uuid,
          OR: [
            {
              isPublic: true,
              status: {
                not: EventStatus.DRAFT,
              },
            },
            ...(user ? [
              { userId: user.id },
              {
                eventOrganizers: {
                  some: {
                    organizer: {
                      organizerMembers: {
                        some: {
                          userId: user.id
                        }
                      }
                    }
                  }
                }
              }
            ] : []),
          ],
        };
      }

      const event = await tx.event.findFirst({
        where: whereClause,
        include: {
          user: {
            select: { uuid: true }
          },
          categories: {
            include: {
              categoryDetails: true
            }
          },
          eventLocations: true,
          ticketTiers: true,
          eventOrganizers: {
            include: {
              organizer: {
                include: {
                  user: {
                    select: { uuid: true }
                  },
                  organizerMembers: {
                    include: {
                      user: {
                        select: { uuid: true }
                      },
                      role: {
                        include: {
                          organizer: {
                            select: { uuid: true }
                          }
                        }
                      }
                    }
                  },
                }
              }
            }
          },
          _count: {
            select: {
              favouritedBy: true,
              rundowns: true,
            }
          }
        }
      });

      if (!event) {
        throw new HttpException(
          !user || user.role !== UserRole.ADMIN 
            ? 'Event not found or you do not have permission to view it'
            : 'Event not found',
          HttpStatus.NOT_FOUND
        );
      }

      let isFavorited = false;

      if (user?.id) {
        const favourite = await tx.favouriteEvent.findFirst({
          where: {
            eventId: event.id,
            userId: user.id,
            deletedAt: null,
          },
          select: {
            id: true,
          },
        });

        isFavorited = !!favourite;
      }

      const normalizedEvent = this.normalizeUuidResponse(event, { parentType: 'event', rootEventUuid: event.uuid });

      return {
        ...normalizedEvent,
        isFavorited,
      };
      });

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error?.message || 'Failed to retrieve event details',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getEventRundowns(user: any, eventUuid: string, query: GetRundownsQueryDto) {
    try {
      if (!eventUuid) {
        throw new HttpException('Event UUID is required', HttpStatus.BAD_REQUEST);
      }

      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Verify Event Existence and Accessibility
        let eventWhereClause: any = { uuid: eventUuid };
      let isAdminOrAffiliated = false;

      if (!user || user.role !== UserRole.ADMIN) {
        eventWhereClause = {
          uuid: eventUuid,
          OR: [
            {
              isPublic: true,
              status: { not: EventStatus.DRAFT },
            },
            ...(user ? [
              { userId: user.id },
              {
                eventOrganizers: {
                  some: {
                    organizer: {
                      organizerMembers: {
                        some: { userId: user.id }
                      }
                    }
                  }
                }
              }
            ] : []),
          ],
        };
      } else {
        isAdminOrAffiliated = true; // Admin has full access
      }

      const event = await tx.event.findFirst({
        where: eventWhereClause,
        include: {
          user: {
            select: { uuid: true }
          },
          eventOrganizers: {
            include: {
              organizer: {
                include: {
                  user: {
                    select: { uuid: true }
                  },
                  organizerMembers: {
                    include: {
                      user: {
                        select: { uuid: true }
                      },
                      role: {
                        include: {
                          organizer: {
                            select: { uuid: true }
                          }
                        }
                      }
                    }
                  },
                }
              }
            }
          }
        }
      });

      if (!event) {
        throw new HttpException('Event not found or you do not have permission to view it', HttpStatus.NOT_FOUND);
      }

      // Check if user is owner or affiliated to determine rundown visibility limits
      if (user && user.role !== UserRole.ADMIN) {
        if (event.userId === user.id) {
          isAdminOrAffiliated = true;
        } else {
          // Check affiliation
          const isAffiliated = event.eventOrganizers.some(eo => 
            eo.organizer.organizerMembers.some(om => om.userId === user.id)
          );
          if (isAffiliated) isAdminOrAffiliated = true;
        }
      }

      // 2. Fetch Rundowns
      const { search, status, visibility, sortBy = 'start', sortOrder = 'asc', groupBy } = query;
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      
      const andConditions: any[] = [{ eventId: event.id }];

      // Filter by visibility rule: non-affiliated users only see PUBLIC
      if (!isAdminOrAffiliated) {
        andConditions.push({ visibility: RundownVisibility.PUBLIC });
      } else if (visibility) {
        andConditions.push({ visibility });
      }

      if (search) {
        andConditions.push({ title: { contains: search } });
      }

      if (status) {
        andConditions.push({ status });
      }

      const finalWhere = { AND: andConditions };

      if (groupBy) {
        const groupedRundowns = await tx.rundown.groupBy({
          by: [groupBy as any],
          where: finalWhere,
          _count: {
            id: true,
          },
        });
        
        if (!groupedRundowns || groupedRundowns.length === 0) {
          throw new HttpException('No rundowns found', HttpStatus.NOT_FOUND);
        }

        return {
          data: groupedRundowns,
          meta: { groupBy }
        };
      }

      const skip = (page - 1) * limit;

      const [total, rundowns] = await Promise.all([
        tx.rundown.count({ where: finalWhere }),
        tx.rundown.findMany({
          where: finalWhere,
          include: {
            location: true,
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
        })
      ]);

      const normalizedRundowns = rundowns.map((rundown) =>
        this.normalizeUuidResponse(rundown, { parentType: 'rundown', rootEventUuid: event.uuid }),
      );

      return {
        data: normalizedRundowns,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        }
      };
      });

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error?.message || 'Failed to retrieve event rundowns',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getRundownDetail(user: any, eventUuid: string, rundownUuid: string) {
    try {
      if (!eventUuid) {
        throw new HttpException('Event UUID is required', HttpStatus.BAD_REQUEST);
      }
      if (!rundownUuid) {
        throw new HttpException('Rundown UUID is required', HttpStatus.BAD_REQUEST);
      }

      const result = await this.prisma.$transaction(async (tx) => {
      // 1. Verify Event Accessibility
      let eventWhereClause: any = { uuid: eventUuid };
      let isAdminOrAffiliated = false;

      if (!user || user.role !== UserRole.ADMIN) {
        eventWhereClause = {
          uuid: eventUuid,
          OR: [
            {
              isPublic: true,
              status: { not: EventStatus.DRAFT },
            },
            ...(user ? [
              { userId: user.id },
              {
                eventOrganizers: {
                  some: {
                    organizer: {
                      organizerMembers: {
                        some: { userId: user.id }
                      }
                    }
                  }
                }
              }
            ] : []),
          ],
        };
      } else {
        isAdminOrAffiliated = true;
      }

      const event = await tx.event.findFirst({
        where: eventWhereClause,
        include: {
          user: {
            select: { uuid: true }
          },
          eventOrganizers: {
            include: {
              organizer: {
                include: {
                  user: {
                    select: { uuid: true }
                  },
                  organizerMembers: true,
                }
              }
            }
          }
        }
      });

      if (!event) {
        throw new HttpException('Event not found or you do not have permission to view it', HttpStatus.NOT_FOUND);
      }

      // 2. Check affiliation
      if (user && user.role !== UserRole.ADMIN) {
        if (event.userId === user.id) {
          isAdminOrAffiliated = true;
        } else {
          const isAffiliated = event.eventOrganizers.some(eo => 
            eo.organizer.organizerMembers.some(om => om.userId === user.id)
          );
          if (isAffiliated) isAdminOrAffiliated = true;
        }
      }

      // 3. Fetch Rundown and apply visibility constraint
      const rundownWhere: any = { 
        uuid: rundownUuid,
        eventId: event.id 
      };

      if (!isAdminOrAffiliated) {
        rundownWhere.visibility = RundownVisibility.PUBLIC;
      }

      const rundown = await tx.rundown.findFirst({
        where: rundownWhere,
        include: {
          location: true,
        }
      });

      if (!rundown) {
        throw new HttpException('Rundown not found or you do not have permission to view it', HttpStatus.NOT_FOUND);
      }

      return this.normalizeUuidResponse(rundown, { parentType: 'rundown', rootEventUuid: event.uuid });
      });

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error?.message || 'Failed to retrieve rundown details',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async updateEvent(user: any, uuid: string, dto: UpdateEventDto) {
    try {
      if (!uuid) {
        throw new HttpException('Event UUID is required', HttpStatus.BAD_REQUEST);
      }
      if (!user || !user.id) {
        throw new HttpException('Unauthorized - User not found in token', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { uuid, deletedAt: null },
        include: {
          user: {
            select: { uuid: true }
          },
          eventOrganizers: {
            include: {
              organizer: {
                include: {
                  user: {
                    select: { uuid: true }
                  },
                  organizerMembers: true,
                }
              }
            }
          }
        }
      });

      if (!event) {
        throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
      }

      let hasPermission = false;
      if (user.role === UserRole.ADMIN || event.userId === user.id) {
        hasPermission = true;
      } else {
        const isAffiliated = event.eventOrganizers.some(eo => 
          eo.organizer.organizerMembers.some(om => om.userId === user.id && om.status === MemberStatus.ACTIVE)
        );
        if (isAffiliated) hasPermission = true;
      }

      if (!hasPermission) {
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      }

      const { categories, organizerUuids, locations, ...scalarData } = dto;

      // Update scalar fields
      let dataToUpdate: any = { ...scalarData };

      // Update categories if provided
      if (categories) {
        // Delete old categories
        await tx.category.deleteMany({ where: { eventId: event.id } });
        
        if (categories.length > 0) {
          dataToUpdate.categories = {
            create: categories.map(tag => ({
              categoryDetails: { create: { name: tag } }
            }))
          };
        }
      }

      // Update event organizers if provided
      if (organizerUuids) {
        await tx.eventOrganizer.deleteMany({ where: { eventId: event.id } });
        
        if (organizerUuids.length > 0) {
          const organizers = await tx.organizer.findMany({
            where: { uuid: { in: organizerUuids } }
          });
          
          if (organizers.length > 0) {
            dataToUpdate.eventOrganizers = {
              create: organizers.map(org => ({
                organizerId: org.id
              }))
            };
          }
        }
      }

      if (locations !== undefined) {
        await tx.eventLocation.deleteMany({ where: { eventId: event.id } });

        const eventLocationCreates = this.buildEventLocationCreates(locations);
        if (eventLocationCreates) {
          dataToUpdate.eventLocations = eventLocationCreates;
        }
      }

      const updatedEvent = await tx.event.update({
        where: { id: event.id },
        data: dataToUpdate,
        include: {
          user: {
            select: { uuid: true }
          },
          categories: { include: { categoryDetails: true } },
          eventLocations: true,
          eventOrganizers: {
            include: {
              organizer: {
                include: {
                  user: {
                    select: { uuid: true }
                  },
                  organizerMembers: true,
                }
              }
            }
          }
        }
      });

      return this.normalizeUuidResponse(updatedEvent, { parentType: 'event', rootEventUuid: event.uuid });
      });

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error?.message || 'Failed to update event',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async uploadBanner(user: any, uuid: string, file: UploadedFileData) {
    try {
      if (!uuid) {
        throw new HttpException('Event UUID is required', HttpStatus.BAD_REQUEST);
      }
      if (!file) {
        throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
      }
      if (!user || !user.id) {
        throw new HttpException('Unauthorized - User not found in token', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { uuid, deletedAt: null },
        include: {
          user: {
            select: { uuid: true }
          },
          eventOrganizers: {
            include: {
              organizer: {
                include: {
                  user: {
                    select: { uuid: true }
                  },
                  organizerMembers: true,
                }
              }
            }
          }
        }
      });

      if (!event) {
        throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
      }

      let hasPermission = false;
      if (user.role === UserRole.ADMIN || event.userId === user.id) {
        hasPermission = true;
      } else {
        const isAffiliated = event.eventOrganizers.some(eo => 
          eo.organizer.organizerMembers.some(om => om.userId === user.id && om.status === MemberStatus.ACTIVE)
        );
        if (isAffiliated) hasPermission = true;
      }

      if (!hasPermission) {
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      }

      const bannerUrl = await this.uploadService.saveImage(file, 'banner', event.uuid);

      const updatedEvent = await tx.event.update({
        where: { id: event.id },
        data: { banner: bannerUrl },
        include: {
          user: {
            select: { uuid: true }
          },
          categories: { include: { categoryDetails: true } },
          eventLocations: true,
          eventOrganizers: {
            include: {
              organizer: {
                include: {
                  user: {
                    select: { uuid: true }
                  },
                  organizerMembers: true,
                }
              }
            }
          },
          ticketTiers: true,
        },
      });

      return this.normalizeUuidResponse(updatedEvent, { parentType: 'event', rootEventUuid: event.uuid });
      });

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error?.message || 'Failed to upload event banner',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async deleteEvent(user: any, uuid: string) {
    try {
      if (!uuid) {
        throw new HttpException('Event UUID is required', HttpStatus.BAD_REQUEST);
      }
      if (!user || !user.id) {
        throw new HttpException('Unauthorized - User not found in token', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const event = await tx.event.findFirst({
          where: { uuid, deletedAt: null },
        });

      if (!event) {
        throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
      }

      // Strictly Owner or Admin only for deletion
      if (user.role !== UserRole.ADMIN && event.userId !== user.id) {
        throw new HttpException('Only Event Owner or Admin can delete the event', HttpStatus.FORBIDDEN);
      }

      await tx.event.update({
        where: { id: event.id },
        data: { deletedAt: new Date() },
      });

      return { message: 'Event deleted successfully' };
      });

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error?.message || 'Failed to delete event',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async createRundown(user: any, eventUuid: string, dto: CreateRundownDto) {
    try {
      if (!eventUuid) {
        throw new HttpException('Event UUID is required', HttpStatus.BAD_REQUEST);
      }
      if (!user || !user.id) {
        throw new HttpException('Unauthorized - User not found in token', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { uuid: eventUuid, deletedAt: null },
        include: {
          user: {
            select: { uuid: true }
          },
          eventOrganizers: {
            include: {
              organizer: {
                include: {
                  user: {
                    select: { uuid: true }
                  },
                  organizerMembers: true,
                }
              }
            }
          }
        }
      });

      if (!event) throw new HttpException('Event not found', HttpStatus.NOT_FOUND);

      let hasPermission = false;
      if (user.role === UserRole.ADMIN || event.userId === user.id) {
        hasPermission = true;
      } else {
        const isAffiliated = event.eventOrganizers.some(eo => 
          eo.organizer.organizerMembers.some(om => om.userId === user.id && om.status === MemberStatus.ACTIVE)
        );
        if (isAffiliated) hasPermission = true;
      }

      if (!hasPermission) throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      const rundown = await tx.rundown.create({
        data: {
          title: dto.title,
          date: dto.date,
          start: dto.start,
          end: dto.end,
          status: dto.status,
          visibility: dto.visibility,
          description: dto.description,
          eventId: event.id,
          locationId: await this.resolveRundownLocationId(tx, event.id, dto.locationUuid),
        },
        include: {
          location: true,
        }
      });

      return this.normalizeUuidResponse(rundown, { parentType: 'rundown', rootEventUuid: event.uuid });
      });

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error?.message || 'Failed to create rundown',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async updateRundown(user: any, eventUuid: string, rundownUuid: string, dto: UpdateRundownDto) {
    try {
      if (!eventUuid) {
        throw new HttpException('Event UUID is required', HttpStatus.BAD_REQUEST);
      }
      if (!rundownUuid) {
        throw new HttpException('Rundown UUID is required', HttpStatus.BAD_REQUEST);
      }
      if (!user || !user.id) {
        throw new HttpException('Unauthorized - User not found in token', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { uuid: eventUuid, deletedAt: null },
        include: {
          user: {
            select: { uuid: true }
          },
          eventOrganizers: {
            include: { organizer: { include: { organizerMembers: true, user: { select: { uuid: true } } } } }
          }
        }
      });

      if (!event) throw new HttpException('Event not found', HttpStatus.NOT_FOUND);

      let hasPermission = false;
      if (user.role === UserRole.ADMIN || event.userId === user.id) {
        hasPermission = true;
      } else {
        const isAffiliated = event.eventOrganizers.some(eo => 
          eo.organizer.organizerMembers.some(om => om.userId === user.id && om.status === MemberStatus.ACTIVE)
        );
        if (isAffiliated) hasPermission = true;
      }

      if (!hasPermission) throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      const rundown = await tx.rundown.findFirst({
        where: { uuid: rundownUuid, eventId: event.id, deletedAt: null }
      });

      if (!rundown) throw new HttpException('Rundown not found', HttpStatus.NOT_FOUND);

      const updatedRundown = await tx.rundown.update({
        where: { id: rundown.id },
        data: {
          title: dto.title,
          date: dto.date,
          start: dto.start,
          end: dto.end,
          status: dto.status,
          visibility: dto.visibility,
          description: dto.description,
          locationId: dto.locationUuid !== undefined
            ? await this.resolveRundownLocationId(tx, event.id, dto.locationUuid)
            : undefined,
        },
        include: {
          location: true,
        }
      });

      return this.normalizeUuidResponse(updatedRundown, { parentType: 'rundown', rootEventUuid: event.uuid });
      });

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error?.message || 'Failed to update rundown',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async deleteRundown(user: any, eventUuid: string, rundownUuid: string) {
    try {
      if (!eventUuid) {
        throw new HttpException('Event UUID is required', HttpStatus.BAD_REQUEST);
      }
      if (!rundownUuid) {
        throw new HttpException('Rundown UUID is required', HttpStatus.BAD_REQUEST);
      }
      if (!user || !user.id) {
        throw new HttpException('Unauthorized - User not found in token', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { uuid: eventUuid, deletedAt: null },
        include: {
          user: {
            select: { uuid: true }
          },
          eventOrganizers: {
            include: { organizer: { include: { organizerMembers: true, user: { select: { uuid: true } } } } }
          }
        }
      });

      if (!event) throw new HttpException('Event not found', HttpStatus.NOT_FOUND);

      // Strictly Owner or Admin only — regular organizer members cannot delete rundowns
      if (user.role !== UserRole.ADMIN && event.userId !== user.id) {
        throw new HttpException('Only Event Owner or Admin can delete rundowns', HttpStatus.FORBIDDEN);
      }

      const rundown = await tx.rundown.findFirst({
        where: { uuid: rundownUuid, eventId: event.id, deletedAt: null }
      });

      if (!rundown) throw new HttpException('Rundown not found', HttpStatus.NOT_FOUND);

      await tx.rundown.update({
        where: { id: rundown.id },
        data: { deletedAt: new Date() }
      });

      return { message: 'Rundown deleted successfully' };
      });

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error?.message || 'Failed to delete rundown',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async addFavouriteEvent(user: any, eventUuid: string) {
    try {
      if (!eventUuid) {
        throw new HttpException('Event UUID is required', HttpStatus.BAD_REQUEST);
      }
      if (!user || !user.id) {
        throw new HttpException('Unauthorized - User not found in token', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { uuid: eventUuid, deletedAt: null },
      });

      if (!event) {
        throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
      }

      // Check if already favorited
      const existingFavourite = await tx.favouriteEvent.findFirst({
        where: { eventId: event.id, userId: user.id, deletedAt: null }
      });

      if (existingFavourite) {
        throw new HttpException('Event is already in your favourites', HttpStatus.BAD_REQUEST);
      }

      // Check if there's a soft-deleted favourite
      const softDeletedFavourite = await tx.favouriteEvent.findFirst({
        where: { eventId: event.id, userId: user.id }
      });

      if (softDeletedFavourite) {
        await tx.favouriteEvent.delete({
          where: { id: softDeletedFavourite.id }
        });
      }

      // Create new
      await tx.favouriteEvent.create({
        data: {
          eventId: event.id,
          userId: user.id
        }
      });

      return { message: 'Event added to favourites' };
      });

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error?.message || 'Failed to add event to favourites',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async removeFavouriteEvent(user: any, eventUuid: string) {
    try {
      if (!eventUuid) {
        throw new HttpException('Event UUID is required', HttpStatus.BAD_REQUEST);
      }
      if (!user || !user.id) {
        throw new HttpException('Unauthorized - User not found in token', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { uuid: eventUuid, deletedAt: null },
      });

      if (!event) {
        throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
      }

      const existingFavourite = await tx.favouriteEvent.findFirst({
        where: { eventId: event.id, userId: user.id, deletedAt: null }
      });

      if (!existingFavourite) {
        throw new HttpException('Event is not in your favourites', HttpStatus.BAD_REQUEST);
      }

      await tx.favouriteEvent.delete({
        where: { id: existingFavourite.id },
      });

      return { message: 'Event removed from favourites' };
      });

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error?.message || 'Failed to remove event from favourites',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async addOrganizerToEvent(user: any, eventUuid: string, dto: AddOrganizerToEventDto) {
    try {
      if (!eventUuid) {
        throw new HttpException('Event UUID is required', HttpStatus.BAD_REQUEST);
      }
      if (!dto?.organizerUuid) {
        throw new HttpException('Organizer UUID is required', HttpStatus.BAD_REQUEST);
      }
      if (!user || !user.id) {
        throw new HttpException('Unauthorized - User not found in token', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Check event exists
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

      // 2. Only Event Owner or Admin can invite organizers
      if (user.role !== UserRole.ADMIN && event.userId !== user.id) {
        throw new HttpException('Only Event Owner or Admin can invite organizers', HttpStatus.FORBIDDEN);
      }

      // 3. Find the organizer
      const organizer = await tx.organizer.findFirst({
        where: { uuid: dto.organizerUuid, deletedAt: null }
      });

      if (!organizer) {
        throw new HttpException('Organizer not found', HttpStatus.NOT_FOUND);
      }

      // 4. Check if EventOrganizer already exists (any status)
      const existing = await tx.eventOrganizer.findFirst({
        where: { eventId: event.id, organizerId: organizer.id, deletedAt: null }
      });

      if (existing) {
        throw new HttpException(
          `Organizer is already ${existing.status.toLowerCase()} for this event`,
          HttpStatus.BAD_REQUEST
        );
      }

      // 5. Create EventOrganizer with PENDING status
      const eventOrganizer = await tx.eventOrganizer.create({
        data: {
          eventId: event.id,
          organizerId: organizer.id,
          status: EventOrganizerStatus.PENDING,
        }
      });

      // 6. If roleUuids provided, create EventOrganizerDetails
      if (dto.roleUuids && dto.roleUuids.length > 0) {
        const roles = await tx.role.findMany({
          where: {
            uuid: { in: dto.roleUuids },
            organizerId: organizer.id,
            deletedAt: null,
          }
        });

        if (roles.length !== dto.roleUuids.length) {
          throw new HttpException(
            'One or more roles not found or do not belong to this organizer',
            HttpStatus.BAD_REQUEST
          );
        }

        await tx.eventOrganizerDetail.createMany({
          data: roles.map(role => ({
            eventOrganizerId: eventOrganizer.id,
            roleId: role.id,
          }))
        });
      }

      const fullEventOrganizer = await tx.eventOrganizer.findUnique({
        where: { id: eventOrganizer.id },
        include: {
          organizer: { include: { user: { select: { uuid: true } } } },
          eventOrganizerDetails: { include: { role: { include: { organizer: { select: { uuid: true } } } } } }
        }
      });

      return this.normalizeUuidResponse(fullEventOrganizer, { parentType: 'eventOrganizer', rootEventUuid: event.uuid });
      });

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error?.message || 'Failed to add organizer to event',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
