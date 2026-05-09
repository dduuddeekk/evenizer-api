import { Controller, Get, Param, Query, HttpException, HttpStatus, UseGuards, Post, Body, Req, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ReviewService } from './review.service';
import { GetReviewsQueryDto, CreateReviewDto } from './dto';
import { APIResponse, ErrorResponse } from '../common/dto';
import { OptionalJwtAuthGuard, JwtAuthGuard } from '../common/guards';
import type { UploadedFile as UploadedFileData } from '../common/types';

@ApiTags('Review')
@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get('event/:eventUuid')
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  async getEventReviews(@Param('eventUuid') eventUuid: string, @Query() query: GetReviewsQueryDto) {
    try {
      const reviews = await this.reviewService.getEventReviews(eventUuid, query);
      return new APIResponse(HttpStatus.OK, 'Event reviews retrieved successfully', reviews);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('organizer/:organizerUuid')
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  async getOrganizerReviews(@Param('organizerUuid') organizerUuid: string, @Query() query: GetReviewsQueryDto) {
    try {
      const reviews = await this.reviewService.getOrganizerReviews(organizerUuid, query);
      return new APIResponse(HttpStatus.OK, 'Organizer reviews retrieved successfully', reviews);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('event/:eventUuid')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('medias'))
  async createEventReview(
    @Req() req: any,
    @Param('eventUuid') eventUuid: string,
    @Body() dto: CreateReviewDto,
    @UploadedFiles() files: UploadedFileData[],
  ) {
    try {
      const review = await this.reviewService.createEventReview(req.user, eventUuid, dto, files);
      return new APIResponse(HttpStatus.CREATED, 'Event review created successfully', review);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('organizer/:organizerUuid')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('medias'))
  async createOrganizerReview(
    @Req() req: any,
    @Param('organizerUuid') organizerUuid: string,
    @Body() dto: CreateReviewDto,
    @UploadedFiles() files: UploadedFileData[],
  ) {
    try {
      const review = await this.reviewService.createOrganizerReview(req.user, organizerUuid, dto, files);
      return new APIResponse(HttpStatus.CREATED, 'Organizer review created successfully', review);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
