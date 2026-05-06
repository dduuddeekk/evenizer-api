/*
  Warnings:

  - A unique constraint covering the columns `[uuid]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `category_details` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `event_organizer_details` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `event_organizers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `events` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `favourite_events` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `follow_organizers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `follow_users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `organizer_members` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `organizers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `roles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `rundowns` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `ticket_tiers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `tickets` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `tokens` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "categories_uuid_key" ON "categories"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "category_details_uuid_key" ON "category_details"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "event_organizer_details_uuid_key" ON "event_organizer_details"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "event_organizers_uuid_key" ON "event_organizers"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "events_uuid_key" ON "events"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "favourite_events_uuid_key" ON "favourite_events"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "follow_organizers_uuid_key" ON "follow_organizers"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "follow_users_uuid_key" ON "follow_users"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "organizer_members_uuid_key" ON "organizer_members"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "organizers_uuid_key" ON "organizers"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "roles_uuid_key" ON "roles"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "rundowns_uuid_key" ON "rundowns"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_tiers_uuid_key" ON "ticket_tiers"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_uuid_key" ON "tickets"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_uuid_key" ON "tokens"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_uuid_key" ON "transactions"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "users_uuid_key" ON "users"("uuid");
