import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { TicketService } from './ticket.service';
import { CreateTicketTierDto, GetUserTicketsQueryDto, UpdateTicketTierDto } from './dto';
import { APIResponse, ErrorResponse } from '../common/dto';
import { JwtAuthGuard } from '../common/guards';

@Controller('ticket')
export class TicketController {
	constructor(private readonly ticketService: TicketService) {}

	@Post('event/:eventUuid')
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard)
	async createTicketTier(
		@Req() req: any,
		@Param('eventUuid') eventUuid: string,
		@Body() dto: CreateTicketTierDto,
	) {
		try {
			const ticketTier = await this.ticketService.createTicketTier(req.user, eventUuid, dto);
			return new APIResponse(HttpStatus.CREATED, 'Ticket created successfully', ticketTier);
		} catch (error: any) {
			if (error instanceof HttpException) throw error;
			throw new HttpException(
				new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
		}
	}

	@Get('event/:eventUuid')
	async getTicketTiersByEvent(
		@Param('eventUuid') eventUuid: string,
	) {
		try {
			const ticketTiers = await this.ticketService.getTicketTiersByEvent(eventUuid);
			return new APIResponse(HttpStatus.OK, 'Tickets retrieved successfully', ticketTiers);
		} catch (error: any) {
			if (error instanceof HttpException) throw error;
			throw new HttpException(
				new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
		}
	}

	@Get('me')
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard)
	async getTicketsByUser(
		@Req() req: any,
		@Query() query: GetUserTicketsQueryDto,
	) {
		try {
			const tickets = await this.ticketService.getTicketsByUser(req.user, query);
			return new APIResponse(HttpStatus.OK, 'User tickets retrieved successfully', tickets);
		} catch (error: any) {
			if (error instanceof HttpException) throw error;
			throw new HttpException(
				new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
		}
	}

	@Get(':ticketTierUuid')
	async getTicketTierDetail(
		@Param('ticketTierUuid') ticketTierUuid: string,
	) {
		try {
			const ticketTier = await this.ticketService.getTicketTierDetail(ticketTierUuid);
			return new APIResponse(HttpStatus.OK, 'Ticket retrieved successfully', ticketTier);
		} catch (error: any) {
			if (error instanceof HttpException) throw error;
			throw new HttpException(
				new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
		}
	}

	@Patch(':ticketTierUuid')
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard)
	async updateTicketTier(
		@Req() req: any,
		@Param('ticketTierUuid') ticketTierUuid: string,
		@Body() dto: UpdateTicketTierDto,
	) {
		try {
			const ticketTier = await this.ticketService.updateTicketTier(req.user, ticketTierUuid, dto);
			return new APIResponse(HttpStatus.OK, 'Ticket updated successfully', ticketTier);
		} catch (error: any) {
			if (error instanceof HttpException) throw error;
			throw new HttpException(
				new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
		}
	}

	@Delete(':ticketTierUuid')
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard)
	async deleteTicketTier(
		@Req() req: any,
		@Param('ticketTierUuid') ticketTierUuid: string,
	) {
		try {
			const result = await this.ticketService.deleteTicketTier(req.user, ticketTierUuid);
			return new APIResponse(HttpStatus.OK, result.message, null);
		} catch (error: any) {
			if (error instanceof HttpException) throw error;
			throw new HttpException(
				new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
		}
	}
}
