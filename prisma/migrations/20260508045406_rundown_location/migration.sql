-- AlterTable
ALTER TABLE "rundowns" ADD COLUMN     "location_id" INTEGER;

-- AddForeignKey
ALTER TABLE "rundowns" ADD CONSTRAINT "rundowns_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "event_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
