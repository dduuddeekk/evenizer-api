-- CreateTable
CREATE TABLE "organizer_locations" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "organizer_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organizer_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizer_locations_uuid_key" ON "organizer_locations"("uuid");

-- AddForeignKey
ALTER TABLE "organizer_locations" ADD CONSTRAINT "organizer_locations_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "organizers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
