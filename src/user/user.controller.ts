import { Controller, Post, Body, HttpStatus, Patch, Param, Req, UseGuards, Get, Delete } from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterDto, UpdateUserAdminDto } from './dto';
import { APIResponse } from '../common/dto';
import { JwtAuthGuard } from '../common/guards';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

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
}

