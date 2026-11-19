-- AlterTable
ALTER TABLE "TradeIn" ADD COLUMN     "photoTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "photoTokenHash" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "TradeInPhoto" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "tradeIn" TEXT,
    "image_id" TEXT,
    "image_filesize" INTEGER,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_extension" TEXT,
    "sortOrder" INTEGER DEFAULT 0,

    CONSTRAINT "TradeInPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradeInPhoto_rooftop_idx" ON "TradeInPhoto"("rooftop");

-- CreateIndex
CREATE INDEX "TradeInPhoto_tradeIn_idx" ON "TradeInPhoto"("tradeIn");

-- AddForeignKey
ALTER TABLE "TradeInPhoto" ADD CONSTRAINT "TradeInPhoto_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeInPhoto" ADD CONSTRAINT "TradeInPhoto_tradeIn_fkey" FOREIGN KEY ("tradeIn") REFERENCES "TradeIn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

