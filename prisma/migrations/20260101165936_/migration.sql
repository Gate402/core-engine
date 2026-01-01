/*
  Warnings:

  - A unique constraint covering the columns `[evmAddress]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "evmAddress" TEXT,
ADD COLUMN     "nonce" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_evmAddress_key" ON "public"."User"("evmAddress");
