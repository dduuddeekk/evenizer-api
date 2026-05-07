import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketTierDto, CreateTicketTierSchema, GetUserTicketsQueryDto, UpdateTicketTierDto, UpdateTicketTierSchema, UserTicketGroupBy, UserTicketSortBy } from './dto';

@Injectable()
export class TicketService {
	constructor(private readonly prisma: PrismaService) {}

	private buildUserTicketOrderBy(sortBy: UserTicketSortBy, sortOrder: 'asc' | 'desc') {
		switch (sortBy) {
			case UserTicketSortBy.CODE:
				return { code: sortOrder };
			case UserTicketSortBy.STATUS:
				return { status: sortOrder };
			case UserTicketSortBy.PAYMENT_STATUS:
				return { transaction: { status: sortOrder } };
			case UserTicketSortBy.PAID_AT:
				return { transaction: { paidAt: sortOrder } };
			case UserTicketSortBy.EVENT_TITLE:
				return { ticketTier: { event: { title: sortOrder } } };
			case UserTicketSortBy.EVENT_START:
				return { ticketTier: { event: { start: sortOrder } } };
			case UserTicketSortBy.CREATED_AT:
			default:
				return { createdAt: sortOrder };
		}
	}

	private async assertEventOwner(tx: any, eventUuid: string, user: any) {
		const event = await tx.event.findFirst({
			where: { uuid: eventUuid, deletedAt: null },
		});

		if (!event) {
			throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
		}

		if (!user) {
			throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
		}

		if (event.userId !== user.id) {
			throw new HttpException('Forbidden: only event owner can modify ticket', HttpStatus.FORBIDDEN);
		}

		return event;
	}

	async createTicketTier(user: any, eventUuid: string, dto: CreateTicketTierDto) {
		try {
			const result = await this.prisma.$transaction(async (tx) => {
				const parsed = CreateTicketTierSchema.parse(dto);
				const event = await this.assertEventOwner(tx, eventUuid, user);

				const ticketTier = await tx.ticketTier.create({
					data: {
						name: parsed.name,
						price: parsed.price,
						quantity: parsed.quantity,
						startSale: parsed.startSale,
						endSale: parsed.endSale,
						description: parsed.description,
						eventId: event.id,
					},
					include: {
						event: {
							select: {
								uuid: true,
								title: true,
							},
						},
					},
				});

				return ticketTier;
			});

			return result;
		} catch (error: any) {
			if (error instanceof HttpException) throw error;
			throw new HttpException(error?.message || 'Failed to create ticket', HttpStatus.BAD_REQUEST);
		}
	}

	async getTicketTiersByEvent(eventUuid: string) {
		try {
			const result = await this.prisma.$transaction(async (tx) => {
				const event = await tx.event.findFirst({
					where: { uuid: eventUuid, deletedAt: null },
					select: { id: true },
				});

				if (!event) {
					throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
				}

				const ticketTiers = await tx.ticketTier.findMany({
					where: { eventId: event.id, deletedAt: null },
					orderBy: { createdAt: 'asc' },
				});

				return ticketTiers;
			});

			return result;
		} catch (error: any) {
			if (error instanceof HttpException) throw error;
			throw new HttpException(error?.message || 'Failed to retrieve tickets', HttpStatus.BAD_REQUEST);
		}
	}

	async getTicketTierDetail(ticketTierUuid: string) {
		try {
			const result = await this.prisma.$transaction(async (tx) => {
				const ticketTier = await tx.ticketTier.findFirst({
					where: { uuid: ticketTierUuid, deletedAt: null },
					include: {
						event: {
							select: {
								uuid: true,
								title: true,
								userId: true,
							},
						},
					},
				});

				if (!ticketTier) {
					throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
				}

				return ticketTier;
			});

			return result;
		} catch (error: any) {
			if (error instanceof HttpException) throw error;
			throw new HttpException(error?.message || 'Failed to retrieve ticket detail', HttpStatus.BAD_REQUEST);
		}
	}

	async getTicketsByUser(user: any, query: GetUserTicketsQueryDto) {
		try {
			const parsedQuery = query;
			const sortBy = parsedQuery.sortBy ?? UserTicketSortBy.CREATED_AT;
			const sortOrder = parsedQuery.sortOrder ?? 'desc';
			const result = await this.prisma.$transaction(async (tx) => {
				const whereClause: any = {
					userId: user.id,
					deletedAt: null,
				};

				if (parsedQuery.status) {
					whereClause.status = parsedQuery.status;
				}

				if (parsedQuery.paymentStatus) {
					whereClause.transaction = {
						status: parsedQuery.paymentStatus,
					};
				}

				const includeClause = {
					transaction: {
						select: {
							uuid: true,
							invoiceNumber: true,
							amount: true,
							paymentMethod: true,
							status: true,
							paidAt: true,
							event: {
								select: {
									uuid: true,
									title: true,
									status: true,
									start: true,
									end: true,
								},
							},
						},
					},
					ticketTier: {
						select: {
							uuid: true,
							name: true,
							price: true,
							event: {
								select: {
									uuid: true,
									title: true,
								},
							},
						},
					},
				};

				if (parsedQuery.groupBy) {
					const tickets = await tx.ticket.findMany({
						where: whereClause,
						include: includeClause,
						orderBy: this.buildUserTicketOrderBy(sortBy, sortOrder),
					});

					const grouped = tickets.reduce((acc: any, ticket: any) => {
						let key: string;

						switch (parsedQuery.groupBy) {
							case UserTicketGroupBy.PAYMENT_STATUS:
								key = ticket.transaction?.status || 'UNKNOWN';
								break;
							case UserTicketGroupBy.EVENT_TITLE:
								key = ticket.ticketTier?.event?.title || 'UNKNOWN';
								break;
							case UserTicketGroupBy.STATUS:
							default:
								key = ticket.status || 'UNKNOWN';
								break;
						}

						if (!acc[key]) {
							acc[key] = [];
						}

						acc[key].push(ticket);
						return acc;
					}, {});

					return {
						data: grouped,
						meta: {
							groupBy: parsedQuery.groupBy,
							total: tickets.length,
						},
					};
				}

				const page = Number(parsedQuery.page) || 1;
				const limit = Number(parsedQuery.limit) || 10;
				const skip = (page - 1) * limit;

				const [total, tickets] = await Promise.all([
					tx.ticket.count({ where: whereClause }),
					tx.ticket.findMany({
						where: whereClause,
						include: includeClause,
						orderBy: this.buildUserTicketOrderBy(sortBy, sortOrder),
						skip,
						take: limit,
					}),
				]);

				return {
					data: tickets,
					meta: {
						total,
						page,
						limit,
						totalPages: Math.ceil(total / limit),
					},
				};
			});

			return result;
		} catch (error: any) {
			if (error instanceof HttpException) throw error;
			throw new HttpException(error?.message || 'Failed to retrieve user tickets', HttpStatus.BAD_REQUEST);
		}
	}

	async updateTicketTier(user: any, ticketTierUuid: string, dto: UpdateTicketTierDto) {
		try {
			const result = await this.prisma.$transaction(async (tx) => {
				const parsed = UpdateTicketTierSchema.parse(dto);

				const ticketTier = await tx.ticketTier.findFirst({
					where: { uuid: ticketTierUuid, deletedAt: null },
					include: { event: true },
				});

				if (!ticketTier) {
					throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
				}

				await this.assertEventOwner(tx, ticketTier.event.uuid, user);

				const updatedTicketTier = await tx.ticketTier.update({
					where: { id: ticketTier.id },
					data: {
						...parsed,
					},
					include: {
						event: {
							select: {
								uuid: true,
								title: true,
							},
						},
					},
				});

				return updatedTicketTier;
			});

			return result;
		} catch (error: any) {
			if (error instanceof HttpException) throw error;
			throw new HttpException(error?.message || 'Failed to update ticket', HttpStatus.BAD_REQUEST);
		}
	}

	async deleteTicketTier(user: any, ticketTierUuid: string) {
		try {
			const result = await this.prisma.$transaction(async (tx) => {
				const ticketTier = await tx.ticketTier.findFirst({
					where: { uuid: ticketTierUuid, deletedAt: null },
					include: { event: true },
				});

				if (!ticketTier) {
					throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
				}

				await this.assertEventOwner(tx, ticketTier.event.uuid, user);

				await tx.ticketTier.update({
					where: { id: ticketTier.id },
					data: {
						deletedAt: new Date(),
					},
				});

				return { message: 'Ticket deleted successfully' };
			});

			return result;
		} catch (error: any) {
			if (error instanceof HttpException) throw error;
			throw new HttpException(error?.message || 'Failed to delete ticket', HttpStatus.BAD_REQUEST);
		}
	}
}
