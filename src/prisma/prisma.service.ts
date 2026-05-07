import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    dotenv.config();
    
    // Use pooled connection URL for PrismaClient with adapter
    // For migrations, Prisma will use DATABASE_DIRECT_URL if available
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Create adapter for direct PostgreSQL connection
    const pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);
    
    super({ adapter } as any);
  }

  async onModuleInit() {
    await this.$connect();
  }
}
