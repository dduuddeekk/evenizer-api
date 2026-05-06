import { Controller, Post, Body, HttpStatus } from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterDto } from './dto/index.dto';
import { APIResponse } from '../common/dto/index.dto';

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
}
