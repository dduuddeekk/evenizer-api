import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { CreateReviewDto, CreateReviewSchema, GetReviewsQueryDto, GetReviewsQuerySchema, UpdateReviewDto, UpdateReviewSchema } from './dto';
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
            userId: user.id,
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
            userId: user.id,
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

  async updateReview(user: any, uuid: string, dto: UpdateReviewDto, files: UploadedFileData[]) {
    try {
      const parsed = UpdateReviewSchema.parse(dto);

      const result = await this.prisma.$transaction(async (tx) => {
        const review = await tx.review.findFirst({
          where: { uuid, deletedAt: null },
        });

        if (!review) {
          throw new HttpException('Review not found', HttpStatus.NOT_FOUND);
        }

        if (review.userId !== user.id) {
          throw new HttpException('You are not authorized to update this review', HttpStatus.FORBIDDEN);
        }

        const updatedReview = await tx.review.update({
          where: { id: review.id },
          data: {
            rating: parsed.rating,
            comment: parsed.comment,
          },
        });

        if (files && files.length > 0) {
          // Note: In a complete implementation, you might want to delete old media 
          // or allow appending new ones based on a more complex DTO. 
          // For now, we will just add the new files.
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
          where: { id: updatedReview.id },
          include: { medias: true, eventReviews: true, organizerReviews: true },
        });
      });

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(error?.message || 'Failed to update review', HttpStatus.BAD_REQUEST);
    }
  }

  async deleteReview(user: any, uuid: string) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const review = await tx.review.findFirst({
          where: { uuid, deletedAt: null },
        });

        if (!review) {
          throw new HttpException('Review not found', HttpStatus.NOT_FOUND);
        }

        if (review.userId !== user.id) {
          throw new HttpException('You are not authorized to delete this review', HttpStatus.FORBIDDEN);
        }

        await tx.review.update({
          where: { id: review.id },
          data: { deletedAt: new Date() },
        });

        return { message: 'Review deleted successfully' };
      });

      return result;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(error?.message || 'Failed to delete review', HttpStatus.BAD_REQUEST);
    }
  }

  async getReviewDetail(uuid: string) {
    try {
      const review = await this.prisma.review.findFirst({
        where: { uuid, deletedAt: null },
        include: {
          user: {
            select: {
              uuid: true,
              username: true,
              profile: true,
            }
          },
          medias: true,
          eventReviews: {
            include: {
              event: {
                select: {
                  uuid: true,
                  title: true,
                  banner: true,
                }
              }
            }
          },
          organizerReviews: {
            include: {
              organizer: {
                select: {
                  uuid: true,
                  name: true,
                  logo: true,
                }
              }
            }
          }
        }
      });

      if (!review) {
        throw new HttpException('Review not found', HttpStatus.NOT_FOUND);
      }

      const isEventReview = review.eventReviews && review.eventReviews.length > 0;
      const isOrganizerReview = review.organizerReviews && review.organizerReviews.length > 0;

      let target: any = null;
      let reviewType = 'UNKNOWN';

      if (isEventReview) {
        reviewType = 'EVENT';
        target = review.eventReviews[0].event;
      } else if (isOrganizerReview) {
        reviewType = 'ORGANIZER';
        target = review.organizerReviews[0].organizer;
      }

      const { eventReviews, organizerReviews, ...reviewData } = review;

      return {
        ...reviewData,
        type: reviewType,
        target,
      };

    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(error?.message || 'Failed to retrieve review detail', HttpStatus.BAD_REQUEST);
    }
  }
}
