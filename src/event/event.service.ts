import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventStatus, UserRole } from '@prisma/client';
import { GetEventsQueryDto } from './dto';

@Injectable()
export class EventService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllEvents(user: any, query: GetEventsQueryDto) {
    try {
      const { search, status, isPublic, sortBy = 'createdAt', sortOrder = 'desc', groupBy } = query;
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
            ...(user ? [{ userId: user.id }] : []),
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
      
      if (status) {
        andConditions.push({ status });
      }

      if (isPublic !== undefined) {
        andConditions.push({ isPublic });
      }

      const finalWhere = andConditions.length > 0 ? { AND: andConditions } : {};

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

      const [total, events] = await Promise.all([
        this.prisma.event.count({ where: finalWhere }),
        this.prisma.event.findMany({
          where: finalWhere,
          include: {
            categories: {
              include: {
                categoryDetails: true
              }
            },
            rundowns: true,
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
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error?.message || 'Failed to retrieve events',
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
