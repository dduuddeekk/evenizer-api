import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { CreateReviewDto, CreateReviewSchema, GetReviewsQueryDto, GetReviewsQuerySchema } from './dto';
import type { UploadedFile as UploadedFileData } from '../common/types';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) { }

  async getEventReviews(eventUuid: string, query: GetReviewsQueryDto) {
    try {
      const parsed = GetReviewsQuerySchema.parse(query);
      const { page, limit, sortBy, sortOrder } = parsed;

      const event = await this.prisma.event.findFirst({
        where: { uuid: eventUuid, deletedAt: null },
      });

      if (!event) {
        throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
      }

      const whereClause: any = {
        deletedAt: null,
        eventReviews: { some: { eventId: event.id } },
      };

      const skip = (page - 1) * limit;

      const [total, reviews] = await Promise.all([
        this.prisma.review.count({ where: whereClause }),
        this.prisma.review.findMany({
          where: whereClause,
          include: { medias: true },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
        }),
      ]);

      return {
        data: reviews,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(error?.message || 'Failed to get event reviews', HttpStatus.BAD_REQUEST);
    }
  }

  async getOrganizerReviews(organizerUuid: string, query: GetReviewsQueryDto) {
    try {
      const parsed = GetReviewsQuerySchema.parse(query);
      const { page, limit, sortBy, sortOrder } = parsed;

      const organizer = await this.prisma.organizer.findFirst({
        where: { uuid: organizerUuid, deletedAt: null },
      });

      if (!organizer) {
        throw new HttpException('Organizer not found', HttpStatus.NOT_FOUND);
      }

      const whereClause: any = {
        deletedAt: null,
        organizerReviews: { some: { organizerId: organizer.id } },
      };

      const skip = (page - 1) * limit;

      const [total, reviews] = await Promise.all([
        this.prisma.review.count({ where: whereClause }),
        this.prisma.review.findMany({
          where: whereClause,
          include: { medias: true },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
        }),
      ]);

      return {
        data: reviews,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(error?.message || 'Failed to get organizer reviews', HttpStatus.BAD_REQUEST);
    }
  }

  async createEventReview(user: any, eventUuid: string, dto: CreateReviewDto, files: UploadedFileData[]) {
    try {
      const parsed = CreateReviewSchema.parse(dto);

      const result = await this.prisma.$transaction(async (tx) => {
        const event = await tx.event.findFirst({
          where: { uuid: eventUuid, deletedAt: null },
        });

        if (!event) {
          throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
        }

        const hasAttended = await tx.ticket.findFirst({
          where: {
            userId: user.id,
            ticketTier: { eventId: event.id },
            status: TicketStatus.ATTENDED,
            deletedAt: null,
          },
        });

        if (!hasAttended) {
          throw new HttpException('You must attend the event before reviewing it', HttpStatus.FORBIDDEN);
        }

        const review = await tx.review.create({
          data: {
            rating: parsed.rating,
            comment: parsed.comment,
            eventReviews: {
              create: {
                eventId: event.id,
              },
            },
          },
        });

        if (files && files.length > 0) {
          for (const file of files) {
            const uploaded = await this.uploadService.saveReviewMedia(file, review.uuid);
            await tx.media.create({
              data: {
                url: uploaded.url,
                type: uploaded.type,
                reviewId: review.id,
              },
            });
          }
        }

        return tx.review.findUnique({
          where: { id: review.id },
          include: {
            medias: true,
            eventReviews: true,
          },
        });
      });

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(error?.message || 'Failed to create event review', HttpStatus.BAD_REQUEST);
    }
  }

  async createOrganizerReview(user: any, organizerUuid: string, dto: CreateReviewDto, files: UploadedFileData[]) {
    try {
      const parsed = CreateReviewSchema.parse(dto);

      const result = await this.prisma.$transaction(async (tx) => {
        const organizer = await tx.organizer.findFirst({
          where: { uuid: organizerUuid, deletedAt: null },
        });

        if (!organizer) {
          throw new HttpException('Organizer not found', HttpStatus.NOT_FOUND);
        }

        const review = await tx.review.create({
          data: {
            rating: parsed.rating,
            comment: parsed.comment,
            organizerReviews: {
              create: {
                organizerId: organizer.id,
              },
            },
          },
        });

        if (files && files.length > 0) {
          for (const file of files) {
            const uploaded = await this.uploadService.saveReviewMedia(file, review.uuid);
            await tx.media.create({
              data: {
                url: uploaded.url,
                type: uploaded.type,
                reviewId: review.id,
              },
            });
          }
        }

        return tx.review.findUnique({
          where: { id: review.id },
          include: {
            medias: true,
            organizerReviews: true,
          },
        });
      });

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(error?.message || 'Failed to create organizer review', HttpStatus.BAD_REQUEST);
    }
  }
}
