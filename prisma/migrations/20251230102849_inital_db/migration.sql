-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "googleId" TEXT,
    "name" TEXT,
    "payoutWallet" TEXT,
    "payoutNetwork" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gateway" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "customDomain" TEXT,
    "originUrl" TEXT NOT NULL,
    "secretToken" TEXT NOT NULL,
    "pricePerRequest" DECIMAL(10,6) NOT NULL,
    "acceptedNetworks" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT,
    "amount" DECIMAL(20,6) NOT NULL,
    "network" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "fromWallet" TEXT NOT NULL,
    "toWallet" TEXT NOT NULL,
    "blockNumber" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "confirmationTime" TIMESTAMP(3),
    "paymentProof" TEXT NOT NULL,
    "platformFee" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "providerRevenue" DECIMAL(20,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestLog" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "paymentRequired" BOOLEAN NOT NULL DEFAULT false,
    "paymentProvided" BOOLEAN NOT NULL DEFAULT false,
    "paymentValid" BOOLEAN NOT NULL DEFAULT false,
    "paymentId" TEXT,
    "durationMs" INTEGER,
    "clientWallet" TEXT,
    "clientIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "Gateway_subdomain_key" ON "Gateway"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "Gateway_customDomain_key" ON "Gateway"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "Gateway_secretToken_key" ON "Gateway"("secretToken");

-- CreateIndex
CREATE INDEX "Gateway_subdomain_idx" ON "Gateway"("subdomain");

-- CreateIndex
CREATE INDEX "Gateway_customDomain_idx" ON "Gateway"("customDomain");

-- CreateIndex
CREATE INDEX "Gateway_userId_idx" ON "Gateway"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionHash_key" ON "Payment"("transactionHash");

-- CreateIndex
CREATE INDEX "Payment_gatewayId_idx" ON "Payment"("gatewayId");

-- CreateIndex
CREATE INDEX "Payment_transactionHash_idx" ON "Payment"("transactionHash");

-- CreateIndex
CREATE INDEX "Payment_fromWallet_idx" ON "Payment"("fromWallet");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_gatewayId_createdAt_idx" ON "RequestLog"("gatewayId", "createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_clientWallet_idx" ON "RequestLog"("clientWallet");

-- AddForeignKey
ALTER TABLE "Gateway" ADD CONSTRAINT "Gateway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestLog" ADD CONSTRAINT "RequestLog_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE CASCADE ON UPDATE CASCADE;
