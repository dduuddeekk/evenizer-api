import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as argon from 'argon2';
import * as crypto from 'crypto';
import { TokenType } from '@prisma/client';
import { RegisterDto } from './dto';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';
import { EmailService } from '../email/email.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService, private readonly emailService: EmailService) { }

  async register(dto: RegisterDto) {
    const created = await this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({ where: { email: dto.email } });

      if (existingUser) {
        throw new HttpException('Email already exists', HttpStatus.BAD_REQUEST);
      }

      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const rawUsername = `${dto.firstName}${dto.lastName}${randomDigits}`;
      const username = rawUsername.toLowerCase().replace(/[^a-z0-9]/g, '');

      const hashedPassword = await argon.hash(dto.password);

      const newUser = await tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          password: hashedPassword,
          username: username,
        },
      });

      // create verification token and send email inside the same transaction
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await tx.token.create({
        data: {
          token,
          type: TokenType.EMAIL_VERIFICATION,
          expiresAt,
          userId: newUser.id,
        },
      });

      // send email; if this throws, the transaction will be rolled back
      await this.emailService.sendVerificationEmail(newUser.email, token, `${newUser.firstName || ''} ${newUser.lastName || ''}`.trim());

      const { password, id, ...userWithoutPasswordAndId } = newUser;
      return userWithoutPasswordAndId;
    });

    return created;
  }

  async updateMyUser(uuid: string, dto: any) {
    const dataToUpdate: any = { ...dto };

    // Prevent non-admin from updating restricted fields
    delete dataToUpdate.email;
    delete dataToUpdate.role;
    delete dataToUpdate.isVerified;

    // Always prevent id, uuid, password update from this endpoint
    delete dataToUpdate.id;
    delete dataToUpdate.uuid;
    delete dataToUpdate.password;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { uuid },
          data: dataToUpdate,
        });

        const { password, id, ...userWithoutPasswordAndId } = updatedUser;
        return userWithoutPasswordAndId;
      });

      return result;
    } catch (error) {
      throw new HttpException('Failed to update user', HttpStatus.BAD_REQUEST);
    }
  }

  async updateUserByAdmin(uuid: string, dto: any) {
    const dataToUpdate: any = { ...dto };

    // Always prevent id, uuid, password update from this endpoint
    delete dataToUpdate.id;
    delete dataToUpdate.uuid;
    delete dataToUpdate.password;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { uuid },
          data: dataToUpdate,
        });

        const { password, id, ...userWithoutPasswordAndId } = updatedUser;
        return userWithoutPasswordAndId;
      });

      return result;
    } catch (error) {
      throw new HttpException('Failed to update user', HttpStatus.BAD_REQUEST);
    }
  }

  async updateProfileImage(uuid: string, imageUrl: string) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { uuid },
          data: { profile: imageUrl },
        });

        const { password, id, ...userWithoutPasswordAndId } = updatedUser;
        return userWithoutPasswordAndId;
      });

      return result;
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

    const result = await this.prisma.$transaction(async (tx) => {
      const allUsers = await tx.user.findMany({ where: whereClause });
      return allUsers.map(({ password, id, ...rest }) => rest);
    });

    return result;
  }

  async getOneUser(uuid: string, currentUser: any) {
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { uuid },
      });

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      const isOwner = currentUser?.uuid === user.uuid;
      const isAdmin = currentUser?.role === UserRole.ADMIN;

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
    });

    return result;
  }

  async deleteUser(uuid: string, currentUser: any) {
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
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

      await tx.user.update({
        where: { uuid },
        data: { deletedAt: new Date() },
      });

      return { message: 'User deleted successfully' };
    });

    return result;
  }

  async followUser(targetUuid: string, currentUser: any) {
    const result = await this.prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({ where: { uuid: targetUuid } });
      if (!targetUser) throw new HttpException('Target user not found', HttpStatus.NOT_FOUND);
      
      if (targetUser.id === currentUser.id) {
        throw new HttpException('You cannot follow yourself', HttpStatus.BAD_REQUEST);
      }

      const existingFollow = await tx.followUser.findFirst({
        where: {
          followerId: currentUser.id,
          followingId: targetUser.id,
        }
      });

      if (existingFollow) {
        return { message: 'Already following this user' };
      }

      await tx.followUser.create({
        data: {
          followerId: currentUser.id,
          followingId: targetUser.id,
        }
      });

      return { message: 'Successfully followed user' };
    });

    return result;
  }

  async unfollowUser(targetUuid: string, currentUser: any) {
    const result = await this.prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({ where: { uuid: targetUuid } });
      if (!targetUser) throw new HttpException('Target user not found', HttpStatus.NOT_FOUND);

      const existingFollow = await tx.followUser.findFirst({
        where: {
          followerId: currentUser.id,
          followingId: targetUser.id,
        }
      });

      if (!existingFollow) {
        return { message: 'You are not following this user' };
      }

      await tx.followUser.delete({
        where: { id: existingFollow.id },
      });

      return { message: 'Successfully unfollowed user' };
    });

    return result;
  }

  async verifyUser(uuid: string, isVerified: boolean) {
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { uuid } });
      if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

      const updatedUser = await tx.user.update({
        where: { uuid },
        data: { isVerified },
      });

      const { password, id, ...userWithoutPasswordAndId } = updatedUser;
      return userWithoutPasswordAndId;
    });

    return result;
  }

  async sendVerificationForUserId(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

    await this.emailService.createAndSendVerification({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName });
    return { message: 'Verification email sent' };
  }

  async verifyEmailToken(token: string) {
    const user = await this.emailService.verifyToken(token);
    return user;
  }
}
