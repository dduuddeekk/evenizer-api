import { Controller, Post, Body, HttpStatus, Patch, Param, Req, UseGuards, Get, Delete, UseInterceptors, UploadedFile, HttpException, Query, Res } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { UserService } from './user.service';
import { UploadService } from '../upload/upload.service';
import type { Response } from 'express';
import type { UploadedFile as UploadedFileData } from '../common/types';
import { RegisterDto, UpdateUserDto, UpdateUserAdminDto, VerifyUserDto } from './dto';
import { APIResponse, ErrorResponse } from '../common/dto';
import { JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard } from '../common/guards';
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
  async verifyEmail(@Query('token') token: string, @Res() res: Response) {
    try {
      await this.userService.verifyEmailToken(token);

      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width,initial-scale=1" />
            <title>Email Verified</title>
            <style>
              body { font-family: Arial, Helvetica, sans-serif; background:#f6f9fc; color:#333; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
              .card { background:#fff; padding:28px; border-radius:10px; box-shadow:0 6px 18px rgba(0,0,0,0.08); max-width:520px; text-align:center; }
              .btn { display:inline-block; margin-top:18px; padding:10px 18px; background:#1f8ef1; color:#fff; text-decoration:none; border-radius:6px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Akun Anda Telah Terverifikasi</h1>
              <p>Terima kasih — email Anda berhasil diverifikasi. Anda sekarang dapat masuk dan menggunakan akun Anda.</p>
            </div>
          </body>
        </html>
      `;

      res.status(HttpStatus.OK).header('Content-Type', 'text/html; charset=utf-8').send(html);
    } catch (error: any) {
      if (error instanceof HttpException) {
        const status = error.getStatus();
        const resp = error.getResponse();
        const msg = typeof resp === 'string' ? resp : (resp as any)?.message || (resp as any)?.error || 'Terjadi kesalahan';

        const errorHtml = `
          <!doctype html>
          <html>
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width,initial-scale=1" />
              <title>Verifikasi Gagal</title>
              <style>
                body { font-family: Arial, Helvetica, sans-serif; background:#f6f9fc; color:#333; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
                .card { background:#fff; padding:28px; border-radius:10px; box-shadow:0 6px 18px rgba(0,0,0,0.08); max-width:520px; text-align:center; }
                .muted { color:#666; margin-top:8px }
                .btn { display:inline-block; margin-top:18px; padding:10px 18px; background:#1f8ef1; color:#fff; text-decoration:none; border-radius:6px; }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>Verifikasi Gagal</h1>
                <p class="muted">${Array.isArray(msg) ? msg.join(' ') : msg}</p>
                <a class="btn" href="${process.env.APP_URL || '/'}">Kembali ke Aplikasi</a>
              </div>
            </body>
          </html>
        `;

        return res.status(status).header('Content-Type', 'text/html; charset=utf-8').send(errorHtml);
      }

      const errorHtml = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width,initial-scale=1" />
            <title>Internal Server Error</title>
          </head>
          <body>
            <h1>Internal Server Error</h1>
            <p>${error?.message || 'Terjadi kesalahan pada server'}</p>
          </body>
        </html>
      `;

      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).header('Content-Type', 'text/html; charset=utf-8').send(errorHtml);
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
  @UseGuards(OptionalJwtAuthGuard)
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
