-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "engine" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "fuelType" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transmission" TEXT;

