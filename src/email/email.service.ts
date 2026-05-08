import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { TokenType } from '@prisma/client';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private logger = new Logger(EmailService.name);

  constructor(private prisma: PrismaService) {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASSWORD;

    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.EMAIL_PORT || '587');
    const secure = process.env.EMAIL_SECURE === 'true' || port === 465;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    } as any);
  }

  async sendVerificationEmail(to: string, token: string, fullname?: string) {
    const base = process.env.EMAIL_VERIFICATION_BASE_URL || process.env.APP_URL || 'https://evenizer-api.vercel.app';
    const verifyUrl = `${base.replace(/\/$/, '')}/user/verify-email?token=${encodeURIComponent(token)}`;

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#333;">
        <h2>Verifikasi Email</h2>
        <p>Hai ${fullname || 'Pengguna'},</p>
        <p>Silakan klik tombol di bawah untuk memverifikasi alamat email Anda.</p>
        <p style="text-align:center;margin:24px 0;">
          <a href="${verifyUrl}" style="background:#1f8ef1;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Verifikasi Email</a>
        </p>
        <p>Jika tombol tidak berfungsi, salin dan tempel tautan berikut ke browser Anda:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <hr />
        <small>Jika Anda tidak meminta verifikasi ini, abaikan saja email ini.</small>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject: 'Verifikasi Email - Evenizer',
      html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Verification email sent to ${to}: ${info.messageId}`);
      return info;
    } catch (err) {
      this.logger.error('Failed sending verification email', err as any);
      throw new HttpException('Failed sending verification email', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createAndSendVerification(user: { id: number; email: string; firstName?: string; lastName?: string }) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.token.create({
      data: {
        token,
        type: TokenType.EMAIL_VERIFICATION,
        expiresAt,
        userId: user.id,
      },
    });

    await this.sendVerificationEmail(user.email, token, `${user.firstName || ''} ${user.lastName || ''}`.trim());
    return { message: 'Verification email sent' };
  }

  async verifyToken(token: string) {
    return await this.prisma.$transaction(async (tx) => {
      const t = await tx.token.findFirst({ where: { token, type: TokenType.EMAIL_VERIFICATION, deletedAt: null } });
      if (!t) throw new HttpException('Invalid or expired token', HttpStatus.BAD_REQUEST);

      if (new Date() > t.expiresAt) {
        await tx.token.update({ where: { id: t.id }, data: { deletedAt: new Date() } });
        throw new HttpException('Token expired', HttpStatus.BAD_REQUEST);
      }

      await tx.user.update({ where: { id: t.userId }, data: { isEmailVerified: true } });
      await tx.token.update({ where: { id: t.id }, data: { deletedAt: new Date() } });

      const user = await tx.user.findUnique({ where: { id: t.userId } });
      if (!user) throw new HttpException('User not found', HttpStatus.NOT_FOUND);

      const { password, id, ...userWithoutPassword } = user as any;
      return userWithoutPassword;
    });
  }
}
