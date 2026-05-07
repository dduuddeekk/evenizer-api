import { Controller, Get, Post, Patch, Delete, Req, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, HttpStatus, HttpException } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrganizerService } from './organizer.service';
import { APIResponse, ErrorResponse } from '../common/dto';
import { OptionalJwtAuthGuard, JwtAuthGuard } from '../common/guards';
import { GetOrganizersQueryDto, CreateOrganizerDto, UpdateOrganizerDto, CreateRoleDto, UpdateRoleDto, InviteMemberDto, UpdateMemberDto } from './dto';

const err = (e: any) => new HttpException(
    new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', e?.message || e),
    HttpStatus.INTERNAL_SERVER_ERROR,
);

@Controller('organizer')
export class OrganizerController {
    constructor(private readonly organizerService: OrganizerService) { }

    @Get()
    @ApiBearerAuth()
    @UseGuards(OptionalJwtAuthGuard)
    async getAllOrganizers(@Req() req: any, @Query() query: GetOrganizersQueryDto) {
        try {
            const organizers = await this.organizerService.getAllOrganizers(req.user, query);
            return new APIResponse(HttpStatus.OK, 'Organizers retrieved successfully', organizers);
        } catch (e: any) { if (e instanceof HttpException) throw e; throw err(e); }
    }

    @Get('event/:eventUuid')
    @ApiBearerAuth()
    @UseGuards(OptionalJwtAuthGuard)
    async getOrganizersByEvent(@Req() req: any, @Param('eventUuid') eventUuid: string) {
        try {
            const organizers = await this.organizerService.getOrganizersByEvent(req.user, eventUuid);
            return new APIResponse(HttpStatus.OK, 'Event organizers retrieved successfully', organizers);
        } catch (e: any) { if (e instanceof HttpException) throw e; throw err(e); }
    }

    @Get(':uuid')
    @ApiBearerAuth()
    @UseGuards(OptionalJwtAuthGuard)
    async getOrganizerDetail(@Req() req: any, @Param('uuid') uuid: string) {
        try {
            const organizer = await this.organizerService.getOrganizerDetail(req.user, uuid);
            return new APIResponse(HttpStatus.OK, 'Organizer retrieved successfully', organizer);
        } catch (e: any) { if (e instanceof HttpException) throw e; throw err(e); }
    }

    @Post()
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    async createOrganizer(@Req() req: any, @Body() dto: CreateOrganizerDto) {
        try {
            const organizer = await this.organizerService.createOrganizer(req.user, dto);
            return new APIResponse(HttpStatus.CREATED, 'Organizer created successfully', organizer);
        } catch (e: any) { if (e instanceof HttpException) throw e; throw err(e); }
    }

    @Post(':uuid/roles')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    async createRole(@Req() req: any, @Param('uuid') uuid: string, @Body() dto: CreateRoleDto) {
        try {
            const role = await this.organizerService.createRole(req.user, uuid, dto);
            return new APIResponse(HttpStatus.CREATED, 'Role created successfully', role);
        } catch (e: any) { if (e instanceof HttpException) throw e; throw err(e); }
    }

    @Patch(':uuid/roles/:roleUuid')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    async updateRole(@Req() req: any, @Param('uuid') uuid: string, @Param('roleUuid') roleUuid: string, @Body() dto: UpdateRoleDto) {
        try {
            const role = await this.organizerService.updateRole(req.user, uuid, roleUuid, dto);
            return new APIResponse(HttpStatus.OK, 'Role updated successfully', role);
        } catch (e: any) { if (e instanceof HttpException) throw e; throw err(e); }
    }

    @Delete(':uuid/roles/:roleUuid')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    async deleteRole(@Req() req: any, @Param('uuid') uuid: string, @Param('roleUuid') roleUuid: string) {
        try {
            const result = await this.organizerService.deleteRole(req.user, uuid, roleUuid);
            return new APIResponse(HttpStatus.OK, result.message, null);
        } catch (e: any) { if (e instanceof HttpException) throw e; throw err(e); }
    }

    @Post(':uuid/members')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    async inviteMember(@Req() req: any, @Param('uuid') uuid: string, @Body() dto: InviteMemberDto) {
        try {
            const member = await this.organizerService.inviteMember(req.user, uuid, dto);
            return new APIResponse(HttpStatus.CREATED, 'Member invited successfully', member);
        } catch (e: any) { if (e instanceof HttpException) throw e; throw err(e); }
    }

    @Patch(':uuid/members/:memberUuid')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    async updateMember(@Req() req: any, @Param('uuid') uuid: string, @Param('memberUuid') memberUuid: string, @Body() dto: UpdateMemberDto) {
        try {
            const member = await this.organizerService.updateMember(req.user, uuid, memberUuid, dto);
            return new APIResponse(HttpStatus.OK, 'Member updated successfully', member);
        } catch (e: any) { if (e instanceof HttpException) throw e; throw err(e); }
    }

    @Delete(':uuid/members/:memberUuid')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    async removeMember(@Req() req: any, @Param('uuid') uuid: string, @Param('memberUuid') memberUuid: string) {
        try {
            const result = await this.organizerService.removeMember(req.user, uuid, memberUuid);
            return new APIResponse(HttpStatus.OK, result.message, null);
        } catch (e: any) { if (e instanceof HttpException) throw e; throw err(e); }
    }

    @Patch(':uuid')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    async updateOrganizer(@Req() req: any, @Param('uuid') uuid: string, @Body() dto: UpdateOrganizerDto) {
        try {
            const organizer = await this.organizerService.updateOrganizer(req.user, uuid, dto);
            return new APIResponse(HttpStatus.OK, 'Organizer updated successfully', organizer);
        } catch (e: any) { if (e instanceof HttpException) throw e; throw err(e); }
    }

    @Patch(':uuid/logo')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @ApiConsumes('multipart/form-data')
    @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
    @UseInterceptors(FileInterceptor('file'))
    async uploadLogo(@Req() req: any, @Param('uuid') uuid: string, @UploadedFile() file: Express.Multer.File) {
        try {
            const organizer = await this.organizerService.uploadLogo(req.user, uuid, file);
            return new APIResponse(HttpStatus.OK, 'Logo updated successfully', organizer);
        } catch (e: any) { if (e instanceof HttpException) throw e; throw err(e); }
    }

    @Delete(':uuid')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    async deleteOrganizer(@Req() req: any, @Param('uuid') uuid: string) {
        try {
            const result = await this.organizerService.deleteOrganizer(req.user, uuid);
            return new APIResponse(HttpStatus.OK, result.message, null);
        } catch (e: any) { if (e instanceof HttpException) throw e; throw err(e); }
    }
}
