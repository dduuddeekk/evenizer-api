-- CreateEnum
CREATE TYPE "EventOrganizerStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "event_organizers" ADD COLUMN     "reject_reason" TEXT,
ADD COLUMN     "status" "EventOrganizerStatus" NOT NULL DEFAULT 'PENDING';
