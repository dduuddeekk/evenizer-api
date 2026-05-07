import { Controller, Get, Post, Patch, Delete, Req, Body, UseGuards, HttpStatus, HttpException, Query, Param, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth } from '@nestjs/swagger';
import { EventService } from './event.service';
import { APIResponse, ErrorResponse } from '../common/dto';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../common/guards';
import { GetEventsQueryDto, CreateEventDto, GetRundownsQueryDto, UpdateEventDto, CreateRundownDto, UpdateRundownDto } from './dto';

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

  @Get('organizer/:organizerUuid')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async getEventsByOrganizer(
    @Req() req: any,
    @Param('organizerUuid') organizerUuid: string,
    @Query() query: GetEventsQueryDto,
  ) {
    try {
      const events = await this.eventService.getEventsByOrganizer(req.user, organizerUuid, query);
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

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('banner'))
  async createEvent(
    @Req() req: any,
    @Body() dto: CreateEventDto,
    @UploadedFile() bannerFile?: Express.Multer.File,
  ) {
    try {
      const event = await this.eventService.createEvent(req.user, dto, bannerFile);
      return new APIResponse(
        HttpStatus.CREATED,
        'Event created successfully',
        event,
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':uuid')
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  async getEventDetail(
    @Req() req: any,
    @Param('uuid') uuid: string,
  ) {
    try {
      const event = await this.eventService.getEventDetail(req.user, uuid);
      return new APIResponse(
        HttpStatus.OK,
        'Event retrieved successfully',
        event,
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':uuid/rundowns')
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  async getEventRundowns(
    @Req() req: any,
    @Param('uuid') uuid: string,
    @Query() query: GetRundownsQueryDto,
  ) {
    try {
      const rundowns = await this.eventService.getEventRundowns(req.user, uuid, query);
      return new APIResponse(
        HttpStatus.OK,
        'Event rundowns retrieved successfully',
        rundowns,
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':eventUuid/rundowns/:rundownUuid')
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  async getRundownDetail(
    @Req() req: any,
    @Param('eventUuid') eventUuid: string,
    @Param('rundownUuid') rundownUuid: string,
  ) {
    try {
      const rundown = await this.eventService.getRundownDetail(req.user, eventUuid, rundownUuid);
      return new APIResponse(
        HttpStatus.OK,
        'Rundown retrieved successfully',
        rundown,
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':uuid')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('banner'))
  async updateEvent(
    @Req() req: any,
    @Param('uuid') uuid: string,
    @Body() dto: UpdateEventDto,
    @UploadedFile() bannerFile?: Express.Multer.File,
  ) {
    try {
      const event = await this.eventService.updateEvent(req.user, uuid, dto, bannerFile);
      return new APIResponse(
        HttpStatus.OK,
        'Event updated successfully',
        event,
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':uuid')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async deleteEvent(
    @Req() req: any,
    @Param('uuid') uuid: string,
  ) {
    try {
      const result = await this.eventService.deleteEvent(req.user, uuid);
      return new APIResponse(
        HttpStatus.OK,
        'Event deleted successfully',
        result,
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':eventUuid/rundowns')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async createRundown(
    @Req() req: any,
    @Param('eventUuid') eventUuid: string,
    @Body() dto: CreateRundownDto,
  ) {
    try {
      const rundown = await this.eventService.createRundown(req.user, eventUuid, dto);
      return new APIResponse(
        HttpStatus.CREATED,
        'Rundown created successfully',
        rundown,
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':eventUuid/rundowns/:rundownUuid')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async updateRundown(
    @Req() req: any,
    @Param('eventUuid') eventUuid: string,
    @Param('rundownUuid') rundownUuid: string,
    @Body() dto: UpdateRundownDto,
  ) {
    try {
      const rundown = await this.eventService.updateRundown(req.user, eventUuid, rundownUuid, dto);
      return new APIResponse(
        HttpStatus.OK,
        'Rundown updated successfully',
        rundown,
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':eventUuid/rundowns/:rundownUuid')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async deleteRundown(
    @Req() req: any,
    @Param('eventUuid') eventUuid: string,
    @Param('rundownUuid') rundownUuid: string,
  ) {
    try {
      const result = await this.eventService.deleteRundown(req.user, eventUuid, rundownUuid);
      return new APIResponse(
        HttpStatus.OK,
        'Rundown deleted successfully',
        result,
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':uuid/favourite')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async addFavouriteEvent(
    @Req() req: any,
    @Param('uuid') uuid: string,
  ) {
    try {
      const result = await this.eventService.addFavouriteEvent(req.user, uuid);
      return new APIResponse(
        HttpStatus.OK,
        result.message,
        result,
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':uuid/favourite')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async removeFavouriteEvent(
    @Req() req: any,
    @Param('uuid') uuid: string,
  ) {
    try {
      const result = await this.eventService.removeFavouriteEvent(req.user, uuid);
      return new APIResponse(
        HttpStatus.OK,
        result.message,
        result,
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
