/*
  Warnings:

  - You are about to drop the column `pricePerRequest` on the `Gateway` table. All the data in the column will be lost.
  - You are about to drop the column `confirmationTime` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `platformFee` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `providerRevenue` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `payoutNetwork` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `payoutWallet` on the `User` table. All the data in the column will be lost.
  - Added the required column `defaultPricePerRequest` to the `Gateway` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "RequestLog_clientWallet_idx";

-- AlterTable
ALTER TABLE "Gateway" DROP COLUMN "pricePerRequest",
ADD COLUMN     "defaultPricePerRequest" DECIMAL(10,6) NOT NULL;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "confirmationTime",
DROP COLUMN "platformFee",
DROP COLUMN "providerRevenue",
DROP COLUMN "updatedAt",
ALTER COLUMN "status" SET DEFAULT 'confirmed';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "payoutNetwork",
DROP COLUMN "payoutWallet",
ADD COLUMN     "quotaResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "requestCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "requestQuota" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "subscriptionStatus" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "subscriptionTier" TEXT NOT NULL DEFAULT 'free';

-- CreateTable
CREATE TABLE "Chain" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nativeCurrency" TEXT NOT NULL,
    "rpcUrl" TEXT,
    "blockExplorer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Token_chainId_idx" ON "Token"("chainId");

-- CreateIndex
CREATE UNIQUE INDEX "Token_chainId_symbol_key" ON "Token"("chainId", "symbol");

-- CreateIndex
CREATE INDEX "Gateway_status_idx" ON "Gateway"("status");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "RequestLog_gatewayId_statusCode_createdAt_idx" ON "RequestLog"("gatewayId", "statusCode", "createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_gatewayId_path_idx" ON "RequestLog"("gatewayId", "path");

-- CreateIndex
CREATE INDEX "RequestLog_clientWallet_createdAt_idx" ON "RequestLog"("clientWallet", "createdAt");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_subscriptionTier_idx" ON "User"("subscriptionTier");

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
