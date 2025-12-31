/*
  Warnings:

  - Added the required column `evmAddress` to the `Gateway` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Gateway" ADD COLUMN     "evmAddress" TEXT NOT NULL,
ADD COLUMN     "paymentNetwork" TEXT NOT NULL DEFAULT 'eip155:84532',
ADD COLUMN     "paymentScheme" TEXT NOT NULL DEFAULT 'exact';
