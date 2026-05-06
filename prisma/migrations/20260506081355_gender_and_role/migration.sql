-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHERS');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "gender" "Gender",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';
