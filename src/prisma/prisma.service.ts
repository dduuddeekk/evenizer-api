import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly hasDatabaseUrl: boolean;

  constructor() {
    dotenv.config();

    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      console.warn('DATABASE_URL is not set; Prisma will initialize without a database adapter.');
      super({} as any);
      this.hasDatabaseUrl = false;
      return;
    }

    const pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);

    super({ adapter } as any);
    this.hasDatabaseUrl = true;
  }

  async onModuleInit() {
    if (!this.hasDatabaseUrl) {
      return;
    }

    await this.$connect();
  }
}
