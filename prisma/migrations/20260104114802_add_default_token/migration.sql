-- AlterTable
ALTER TABLE "Gateway" ADD COLUMN     "defaultToken" TEXT,
ALTER COLUMN "defaultPricePerRequest" SET DATA TYPE TEXT;
