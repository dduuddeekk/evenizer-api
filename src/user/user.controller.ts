import { Controller, Post, Body, HttpStatus, Patch, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterDto, UpdateUserDto, UpdateUserAdminDto } from './dto/index.dto';
import { APIResponse } from '../common/dto/index.dto';
import { JwtAuthGuard } from '../common/guards/index.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

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
}
