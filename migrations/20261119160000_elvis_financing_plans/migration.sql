-- CreateTable
CREATE TABLE "Bank" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "website" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "providerKey" TEXT NOT NULL DEFAULT 'manual',

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancingPlan" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bank" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "tnaBps" INTEGER NOT NULL,
    "teaBps" INTEGER,
    "cftBps" INTEGER,
    "termsMonths" TEXT NOT NULL DEFAULT '',
    "minAmountCents" DOUBLE PRECISION,
    "maxAmountCents" DOUBLE PRECISION,
    "maxFinancedBps" INTEGER,
    "amortization" TEXT NOT NULL DEFAULT 'frances',
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "extraCosts" TEXT NOT NULL DEFAULT '',
    "requirements" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER DEFAULT 0,

    CONSTRAINT "FinancingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancingPlan_bank_idx" ON "FinancingPlan"("bank");

-- AddForeignKey
ALTER TABLE "FinancingPlan" ADD CONSTRAINT "FinancingPlan_bank_fkey" FOREIGN KEY ("bank") REFERENCES "Bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

