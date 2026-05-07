import { Controller, Get, Post, Req, Body, Param, Query, UseGuards, HttpStatus, HttpException } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { OrganizerService } from './organizer.service';
import { APIResponse, ErrorResponse } from '../common/dto';
import { OptionalJwtAuthGuard, JwtAuthGuard } from '../common/guards';
import { GetOrganizersQueryDto, CreateOrganizerDto } from './dto';

@Controller('organizer')
export class OrganizerController {
    constructor(private readonly organizerService: OrganizerService) { }

    @Get()
    @ApiBearerAuth()
    @UseGuards(OptionalJwtAuthGuard)
    async getAllOrganizers(
        @Req() req: any,
        @Query() query: GetOrganizersQueryDto,
    ) {
        try {
            const organizers = await this.organizerService.getAllOrganizers(req.user, query);
            return new APIResponse(HttpStatus.OK, 'Organizers retrieved successfully', organizers);
        } catch (error: any) {
            if (error instanceof HttpException) throw error;
            throw new HttpException(new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('event/:eventUuid')
    @ApiBearerAuth()
    @UseGuards(OptionalJwtAuthGuard)
    async getOrganizersByEvent(
        @Req() req: any,
        @Param('eventUuid') eventUuid: string,
    ) {
        try {
            const organizers = await this.organizerService.getOrganizersByEvent(req.user, eventUuid);
            return new APIResponse(HttpStatus.OK, 'Event organizers retrieved successfully', organizers);
        } catch (error: any) {
            if (error instanceof HttpException) throw error;
            throw new HttpException(new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get(':uuid')
    @ApiBearerAuth()
    @UseGuards(OptionalJwtAuthGuard)
    async getOrganizerDetail(
        @Req() req: any,
        @Param('uuid') uuid: string,
    ) {
        try {
            const organizer = await this.organizerService.getOrganizerDetail(req.user, uuid);
            return new APIResponse(HttpStatus.OK, 'Organizer retrieved successfully', organizer);
        } catch (error: any) {
            if (error instanceof HttpException) throw error;
            throw new HttpException(new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post()
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    async createOrganizer(
        @Req() req: any,
        @Body() dto: CreateOrganizerDto,
    ) {
        try {
            const organizer = await this.organizerService.createOrganizer(req.user, dto);
            return new APIResponse(HttpStatus.CREATED, 'Organizer created successfully', organizer);
        } catch (error: any) {
            if (error instanceof HttpException) throw error;
            throw new HttpException(new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
