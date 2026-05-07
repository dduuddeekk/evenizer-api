-- CreateEnum
CREATE TYPE "OrganizerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BANNED');

-- AlterTable
ALTER TABLE "organizers" ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "OrganizerStatus" NOT NULL DEFAULT 'ACTIVE';
