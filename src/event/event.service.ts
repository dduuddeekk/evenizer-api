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

  async getAllEvents(user: any, query: GetEventsQueryDto) {
    try {
      const { search, category, status, isPublic, sortBy = 'createdAt', sortOrder = 'desc', groupBy } = query;
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      let whereClause: any = {};

      if (!user || user.role !== UserRole.ADMIN) {
        // Normal user or guest logic
        whereClause = {
          OR: [
            // Can see if it's public AND not a draft
            {
              isPublic: true,
              status: {
                not: EventStatus.DRAFT,
              },
            },
            // If logged in, can also see their own events regardless of status or visibility
            ...(user ? [
              { userId: user.id },
              {
                eventOrganizers: {
                  some: {
                    organizer: {
                      organizerMembers: {
                        some: {
                          userId: user.id,
                          status: MemberStatus.ACTIVE, // Only ACTIVE members can see
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

      // Add query filters if provided
      const andConditions: any[] = [];
      if (Object.keys(whereClause).length > 0) {
        andConditions.push(whereClause);
      }

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

      const finalWhere = andConditions.length > 0 ? { AND: andConditions } : {};

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

      if (!events || events.length === 0) {
        throw new HttpException('No events found', HttpStatus.NOT_FOUND);
      }

      const paginatedResult = {
        data: events,
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
        error?.message || 'Failed to retrieve events',
        HttpStatus.BAD_REQUEST
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

      if (!events || events.length === 0) {
        throw new HttpException('No events found', HttpStatus.NOT_FOUND);
      }

      return {
        data: events,
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
      const result = await this.prisma.$transaction(async (tx) => {
        const { title, start, end, status, isPublic, banner, description, categories, locations } = dto;

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

        let event = await tx.event.create({
          data: {
            title,
            start,
            end,
            status: status || EventStatus.DRAFT,
            isPublic: isPublic || false,
            banner: dto.banner,
            description,
            userId: user.id, // Linked to the authenticated user
            categories: categoriesData,
            eventLocations: this.buildEventLocationCreates(locations)
          },
          include: {
            categories: {
              include: {
                categoryDetails: true
              }
            },
            eventLocations: true
          }
        });

        return event;
      });

      return result;
    } catch (error: any) {
      throw new HttpException(
        error?.message || 'Failed to create event',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  async getEventDetail(user: any, uuid: string) {
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
          categories: {
            include: {
              categoryDetails: true
            }
          },
          eventLocations: true,
          ticketTiers: true,
          eventOrganizers: {
            include: {
              organizer: true
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
        throw new HttpException('Event not found or you do not have permission to view it', HttpStatus.NOT_FOUND);
      }

      return event;
    });

    return result;
  }

  async getEventRundowns(user: any, eventUuid: string, query: GetRundownsQueryDto) {
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
          eventOrganizers: {
            include: {
              organizer: {
                include: {
                  organizerMembers: true
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

      if (!rundowns || rundowns.length === 0) {
        throw new HttpException('No rundowns found', HttpStatus.NOT_FOUND);
      }

      return {
        data: rundowns,
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

  async getRundownDetail(user: any, eventUuid: string, rundownUuid: string) {
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
          eventOrganizers: {
            include: {
              organizer: {
                include: { organizerMembers: true }
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

      return rundown;
    });

    return result;
  }

  async updateEvent(user: any, uuid: string, dto: UpdateEventDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { uuid, deletedAt: null },
        include: {
          eventOrganizers: {
            include: { organizer: { include: { organizerMembers: true } } }
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
          categories: { include: { categoryDetails: true } },
          eventLocations: true,
          eventOrganizers: { include: { organizer: true } }
        }
      });

      return updatedEvent;
    });

    return result;
  }

  async uploadBanner(user: any, uuid: string, file: UploadedFileData) {
    const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { uuid, deletedAt: null },
        include: {
          eventOrganizers: {
            include: { organizer: { include: { organizerMembers: true } } }
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
      });

      return updatedEvent;
    });

    return result;
  }

  async deleteEvent(user: any, uuid: string) {
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
  }

  async createRundown(user: any, eventUuid: string, dto: CreateRundownDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { uuid: eventUuid, deletedAt: null },
        include: {
          eventOrganizers: {
            include: { organizer: { include: { organizerMembers: true } } }
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

      return rundown;
    });

    return result;
  }

  async updateRundown(user: any, eventUuid: string, rundownUuid: string, dto: UpdateRundownDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { uuid: eventUuid, deletedAt: null },
        include: {
          eventOrganizers: {
            include: { organizer: { include: { organizerMembers: true } } }
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

      return updatedRundown;
    });

    return result;
  }

  async deleteRundown(user: any, eventUuid: string, rundownUuid: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { uuid: eventUuid, deletedAt: null },
        include: {
          eventOrganizers: {
            include: { organizer: { include: { organizerMembers: true } } }
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
  }

  async addFavouriteEvent(user: any, eventUuid: string) {
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
        // Restore it
        await tx.favouriteEvent.update({
          where: { id: softDeletedFavourite.id },
          data: { deletedAt: null }
        });
      } else {
        // Create new
        await tx.favouriteEvent.create({
          data: {
            eventId: event.id,
            userId: user.id
          }
        });
      }

      return { message: 'Event added to favourites' };
    });

    return result;
  }

  async removeFavouriteEvent(user: any, eventUuid: string) {
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

      await tx.favouriteEvent.update({
        where: { id: existingFavourite.id },
        data: { deletedAt: new Date() }
      });

      return { message: 'Event removed from favourites' };
    });

    return result;
  }

  async addOrganizerToEvent(user: any, eventUuid: string, dto: AddOrganizerToEventDto) {
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
          organizer: true,
          eventOrganizerDetails: { include: { role: true } }
        }
      });

      return fullEventOrganizer;
    });

    return result;
  }
}
