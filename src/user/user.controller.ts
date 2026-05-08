import { Controller, Post, Body, HttpStatus, Patch, Param, Req, UseGuards, Get, Delete, UseInterceptors, UploadedFile, HttpException, Query } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { UserService } from './user.service';
import { UploadService } from '../upload/upload.service';
import type { UploadedFile as UploadedFileData } from '../common/types';
import { RegisterDto, UpdateUserDto, UpdateUserAdminDto, VerifyUserDto } from './dto';
import { APIResponse, ErrorResponse } from '../common/dto';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly uploadService: UploadService,
  ) { }

  @Post('me/send-verification')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async sendMyVerification(@Req() req: any) {
    try {
      const result = await this.userService.sendVerificationForUserId(req.user.id);
      return new APIResponse(HttpStatus.OK, 'Verification email sent', result);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    try {
      const user = await this.userService.verifyEmailToken(token);
      return new APIResponse(HttpStatus.OK, 'Email verified successfully', user);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    try {
      const user = await this.userService.register(dto);
      return new APIResponse(
        HttpStatus.CREATED,
        'User registered successfully',
        user,
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async updateMyUser(
    @Body() dto: UpdateUserDto,
    @Req() req: any,
  ) {
    try {
      const user = await this.userService.updateMyUser(req.user.uuid, dto);
      return new APIResponse(
        HttpStatus.OK,
        'User updated successfully',
        user,
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
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateUser(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateUserAdminDto,
  ) {
    try {
      const user = await this.userService.updateUserByAdmin(uuid, dto);
      return new APIResponse(
        HttpStatus.OK,
        'User updated successfully',
        user,
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async getAllUsers(@Req() req: any) {
    try {
      const users = await this.userService.getAllUsers(req.user);
      return new APIResponse(
        HttpStatus.OK,
        'Users retrieved successfully',
        users,
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
  @UseGuards(JwtAuthGuard)
  async getOneUser(
    @Param('uuid') uuid: string,
    @Req() req: any,
  ) {
    try {
      const user = await this.userService.getOneUser(uuid, req.user);
      return new APIResponse(
        HttpStatus.OK,
        'User retrieved successfully',
        user,
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
  async deleteUser(
    @Param('uuid') uuid: string,
    @Req() req: any,
  ) {
    try {
      const result = await this.userService.deleteUser(uuid, req.user);
      return new APIResponse(
        HttpStatus.OK,
        result.message,
        null,
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('me/profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadMyProfile(
    @UploadedFile() file: UploadedFileData,
    @Req() req: any,
  ) {
    try {
      const uuid = req.user.uuid;
      const imageUrl = await this.uploadService.saveImage(file, 'profile', uuid);
      const user = await this.userService.updateProfileImage(uuid, imageUrl);
      
      return new APIResponse(
        HttpStatus.OK,
        'Profile image updated successfully',
        user,
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':uuid/profile')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfile(
    @Param('uuid') uuid: string,
    @UploadedFile() file: UploadedFileData,
  ) {
    try {
      const imageUrl = await this.uploadService.saveImage(file, 'profile', uuid);
      const user = await this.userService.updateProfileImage(uuid, imageUrl);
      
      return new APIResponse(
        HttpStatus.OK,
        'Profile image updated successfully',
        user,
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':uuid/follow')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async followUser(
    @Param('uuid') uuid: string,
    @Req() req: any,
  ) {
    try {
      const result = await this.userService.followUser(uuid, req.user);
      return new APIResponse(
        HttpStatus.OK,
        'Successfully followed user',
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

  @Delete(':uuid/follow')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async unfollowUser(
    @Param('uuid') uuid: string,
    @Req() req: any,
  ) {
    try {
      const result = await this.userService.unfollowUser(uuid, req.user);
      return new APIResponse(
        HttpStatus.OK,
        'Successfully unfollowed user',
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

  @Patch(':uuid/verify')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async verifyUser(
    @Param('uuid') uuid: string,
    @Body() dto: VerifyUserDto,
  ) {
    try {
      const user = await this.userService.verifyUser(uuid, dto.isVerified);
      return new APIResponse(
        HttpStatus.OK,
        'User verification status updated successfully',
        user,
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
