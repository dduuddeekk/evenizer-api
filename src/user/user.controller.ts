import { Controller, Post, Body, HttpStatus, Patch, Param, Req, UseGuards, Get, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { UploadService } from '../upload/upload.service';
import { RegisterDto, UpdateUserAdminDto } from './dto';
import { APIResponse } from '../common/dto';
import { JwtAuthGuard } from '../common/guards';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly uploadService: UploadService,
  ) { }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.userService.register(dto);
    return new APIResponse(
      HttpStatus.CREATED,
      'User registered successfully',
      user,
    );
  }

  @Patch(':uuid')
  @UseGuards(JwtAuthGuard)
  async updateUser(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateUserAdminDto,
    @Req() req: any,
  ) {
    const user = await this.userService.updateUser(uuid, dto, req.user);
    return new APIResponse(
      HttpStatus.OK,
      'User updated successfully',
      user,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllUsers(@Req() req: any) {
    const users = await this.userService.getAllUsers(req.user);
    return new APIResponse(
      HttpStatus.OK,
      'Users retrieved successfully',
      users,
    );
  }

  @Get(':uuid')
  @UseGuards(JwtAuthGuard)
  async getOneUser(
    @Param('uuid') uuid: string,
    @Req() req: any,
  ) {
    const user = await this.userService.getOneUser(uuid, req.user);
    return new APIResponse(
      HttpStatus.OK,
      'User retrieved successfully',
      user,
    );
  }

  @Delete(':uuid')
  @UseGuards(JwtAuthGuard)
  async deleteUser(
    @Param('uuid') uuid: string,
    @Req() req: any,
  ) {
    const result = await this.userService.deleteUser(uuid, req.user);
    return new APIResponse(
      HttpStatus.OK,
      result.message,
      null,
    );
  }

  @Patch(':uuid/profile')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfile(
    @Param('uuid') uuid: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const imageUrl = await this.uploadService.saveImage(file, 'profile', uuid);
    const user = await this.userService.updateProfileImage(uuid, imageUrl, req.user);
    
    return new APIResponse(
      HttpStatus.OK,
      'Profile image updated successfully',
      user,
    );
  }
}

