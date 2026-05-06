import { Controller, Post, Body, Req, UseGuards, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto } from './dto';
import { APIResponse } from '../common/dto';
import { JwtAuthGuard } from '../common/guards';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return new APIResponse(HttpStatus.OK, 'Login successful', result);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: any) {
    // req.headers.authorization will have "Bearer <token>"
    const authHeader = req.headers.authorization;
    const token = authHeader.split(' ')[1];

    await this.authService.logout(token);
    return new APIResponse(HttpStatus.OK, 'Logout successful', null);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    const result = await this.authService.refresh(dto);
    return new APIResponse(HttpStatus.OK, 'Token refreshed successfully', result);
  }
}

