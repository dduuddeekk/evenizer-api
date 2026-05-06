import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as argon from 'argon2';
import { RegisterDto } from './dto';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) { }

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

    const { password, id, ...userWithoutPasswordAndId } = newUser;

    return userWithoutPasswordAndId;
  }

  async updateUser(uuid: string, dto: any, currentUser: any) {
    if (currentUser.role !== UserRole.ADMIN && currentUser.uuid !== uuid) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    const dataToUpdate: any = { ...dto };

    // Prevent non-admin from updating restricted fields
    if (currentUser.role !== UserRole.ADMIN) {
      delete dataToUpdate.email;
      delete dataToUpdate.role;
      delete dataToUpdate.isVerified;
    }

    // Always prevent id, uuid, password update from this endpoint
    delete dataToUpdate.id;
    delete dataToUpdate.uuid;
    delete dataToUpdate.password;

    try {
      // Find the user to get their actual ID if needed, or update directly by UUID since it's unique
      const updatedUser = await this.prisma.user.update({
        where: { uuid },
        data: dataToUpdate,
      });

      const { password, id, ...userWithoutPasswordAndId } = updatedUser;
      return userWithoutPasswordAndId;
    } catch (error) {
      throw new HttpException('Failed to update user', HttpStatus.BAD_REQUEST);
    }
  }

  async updateProfileImage(uuid: string, imageUrl: string, currentUser: any) {
    if (currentUser.role !== UserRole.ADMIN && currentUser.uuid !== uuid) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { uuid },
        data: { profile: imageUrl },
      });

      const { password, id, ...userWithoutPasswordAndId } = updatedUser;
      return userWithoutPasswordAndId;
    } catch (error) {
      throw new HttpException('Failed to update profile image', HttpStatus.BAD_REQUEST);
    }
  }

  async getAllUsers(currentUser: any) {
    let whereClause: any = {};

    if (currentUser.role !== UserRole.ADMIN) {
      whereClause = {
        status: UserStatus.ACTIVE,
        deletedAt: null,
      };
    }
    // If ADMIN, no where clause, gets all

    const allUsers = await this.prisma.user.findMany({ where: whereClause });
    return allUsers.map(({ password, id, ...rest }) => rest);
  }

  async getOneUser(uuid: string, currentUser: any) {
    const user = await this.prisma.user.findUnique({
      where: { uuid },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const isOwner = currentUser.uuid === user.uuid;
    const isAdmin = currentUser.role === UserRole.ADMIN;

    // Check visibility
    if (user.deletedAt !== null || user.status === UserStatus.BANNED) {
      if (!isAdmin) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
    } else if (user.status === UserStatus.INACTIVE) {
      if (!isAdmin && !isOwner) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
    }

    const { password, id, ...userWithoutPasswordAndId } = user;
    return userWithoutPasswordAndId;
  }

  async deleteUser(uuid: string, currentUser: any) {
    const user = await this.prisma.user.findUnique({
      where: { uuid },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const isOwner = currentUser.uuid === user.uuid;
    const isAdmin = currentUser.role === UserRole.ADMIN;

    if (!isAdmin && !isOwner) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    await this.prisma.user.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { message: 'User deleted successfully' };
  }
}

