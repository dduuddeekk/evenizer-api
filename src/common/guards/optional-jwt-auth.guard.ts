import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    // If there is an error or no user, just return null instead of throwing UnauthorizedException
    if (err) {
      throw err;
    }
    return user || null;
  }
}
