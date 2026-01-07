-- AlterTable
ALTER TABLE "RequestLog" ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "errorType" TEXT,
ADD COLUMN     "originLatencyMs" INTEGER,
ADD COLUMN     "paymentAmount" TEXT,
ADD COLUMN     "paymentNetwork" TEXT,
ADD COLUMN     "paymentToken" TEXT,
ADD COLUMN     "paymentVerifyMs" INTEGER,
ADD COLUMN     "settlementMs" INTEGER,
ADD COLUMN     "settlementStatus" TEXT,
ADD COLUMN     "settlementTxHash" TEXT;

-- CreateTable
CREATE TABLE "DailyStats" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "paidRequests" INTEGER NOT NULL DEFAULT 0,
    "failedRequests" INTEGER NOT NULL DEFAULT 0,
    "paymentAttempts" INTEGER NOT NULL DEFAULT 0,
    "successfulPayments" INTEGER NOT NULL DEFAULT 0,
    "failedPayments" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" TEXT NOT NULL DEFAULT '0',
    "uniquePayers" INTEGER NOT NULL DEFAULT 0,
    "avgLatencyMs" INTEGER,
    "p95LatencyMs" INTEGER,
    "avgOriginMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyStats_gatewayId_date_idx" ON "DailyStats"("gatewayId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStats_gatewayId_date_key" ON "DailyStats"("gatewayId", "date");

-- CreateIndex
CREATE INDEX "RequestLog_settlementTxHash_idx" ON "RequestLog"("settlementTxHash");

-- CreateIndex
CREATE INDEX "RequestLog_paymentNetwork_createdAt_idx" ON "RequestLog"("paymentNetwork", "createdAt");
