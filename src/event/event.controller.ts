import { Controller, Get, Req, UseGuards, HttpStatus, HttpException, Query } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { EventService } from './event.service';
import { APIResponse, ErrorResponse } from '../common/dto';
import { OptionalJwtAuthGuard } from '../common/guards';
import { GetEventsQueryDto } from './dto';

@Controller('event')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  async getAllEvents(
    @Req() req: any,
    @Query() query: GetEventsQueryDto,
  ) {
    try {
      const events = await this.eventService.getAllEvents(req.user, query);
      return new APIResponse(
        HttpStatus.OK,
        'Events retrieved successfully',
        events,
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
