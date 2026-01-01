/*
  Warnings:

  - A unique constraint covering the columns `[evmAddress]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "User_evmAddress_key" ON "public"."User"("evmAddress");
