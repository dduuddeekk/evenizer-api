-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'BANNED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "organizer_members" DROP CONSTRAINT "organizer_members_role_id_fkey";

-- AlterTable
ALTER TABLE "organizer_members" ADD COLUMN     "reason" TEXT,
ADD COLUMN     "status" "MemberStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "role_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "organizer_members" ADD CONSTRAINT "organizer_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
