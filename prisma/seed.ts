import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole, UserStatus, Gender } from "@prisma/client";
import * as argon from "argon2";

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const adminPassword = process.env.ADMIN_PASSWORD!;
    const hashedPassword = await argon.hash(adminPassword);

    const admin = await prisma.user.upsert({
        where: { email: process.env.ADMIN_EMAIL! },
        update: {
            password: hashedPassword,
            firstName: process.env.ADMIN_FIRSTNAME!,
            lastName: process.env.ADMIN_LASTNAME!,
            username: process.env.ADMIN_USERNAME!,
            isEmailVerified: true,
            isVerified: true,
            role: UserRole.ADMIN,
            gender: Gender.OTHERS,
            status: UserStatus.ACTIVE,
        },
        create: {
            email: process.env.ADMIN_EMAIL!,
            password: hashedPassword,
            firstName: process.env.ADMIN_FIRSTNAME!,
            lastName: process.env.ADMIN_LASTNAME!,
            username: process.env.ADMIN_USERNAME!,
            isEmailVerified: true,
            isVerified: true,
            role: UserRole.ADMIN,
            gender: Gender.OTHERS,
            status: UserStatus.ACTIVE,
        },
    });

    console.log("Admin seeded/updated:", admin.email);
}

main()
    .then(async () => {
        await prisma.$disconnect();
        await pool.end();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        await pool.end();
        process.exit(1);
    });