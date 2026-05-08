-- CreateEnum
CREATE TYPE "EventLocationType" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');

-- CreateTable
CREATE TABLE "event_locations" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "type" "EventLocationType" NOT NULL,
    "location" TEXT NOT NULL,
    "event_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "event_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_locations_uuid_key" ON "event_locations"("uuid");

-- AddForeignKey
ALTER TABLE "event_locations" ADD CONSTRAINT "event_locations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
