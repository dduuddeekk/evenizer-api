import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as argon from 'argon2';
import { RegisterDto } from './dto/index.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new HttpException('Email already exists', HttpStatus.BAD_REQUEST);
    }

    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const rawUsername = `${dto.firstName}${dto.lastName}${randomDigits}`;
    const username = rawUsername.toLowerCase().replace(/[^a-z0-9]/g, '');

    const hashedPassword = await argon.hash(dto.password);

    const newUser = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        password: hashedPassword,
        username: username,
      },
    });

    const { password, ...userWithoutPassword } = newUser;

    return userWithoutPassword;
  }
}
