/*
  Warnings:

  - You are about to drop the column `acceptedNetworks` on the `Gateway` table. All the data in the column will be lost.
  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_gatewayId_fkey";

-- AlterTable
ALTER TABLE "Gateway" DROP COLUMN "acceptedNetworks";

-- DropTable
DROP TABLE "Payment";
