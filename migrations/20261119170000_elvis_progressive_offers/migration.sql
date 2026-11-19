-- CreateTable
CREATE TABLE "ProgressiveOffer" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "number" INTEGER,
    "title" TEXT NOT NULL DEFAULT '',
    "vehicle" TEXT,
    "photo_id" TEXT,
    "photo_filesize" INTEGER,
    "photo_width" INTEGER,
    "photo_height" INTEGER,
    "photo_extension" TEXT,
    "photoUrl" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "startPriceCents" DOUBLE PRECISION NOT NULL,
    "stepCents" DOUBLE PRECISION NOT NULL,
    "stepEvery" INTEGER NOT NULL DEFAULT 1,
    "stepUnit" TEXT NOT NULL DEFAULT 'hours',
    "stepMinutes" INTEGER DEFAULT 60,
    "floorPriceCents" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "soldAt" TIMESTAMP(3),
    "financing" TEXT NOT NULL DEFAULT '',
    "conditions" TEXT NOT NULL DEFAULT '',
    "includesTransfer" TEXT DEFAULT 'included',
    "noAppointment" TEXT DEFAULT 'walk-in',

    CONSTRAINT "ProgressiveOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgressiveOffer_vehicle_idx" ON "ProgressiveOffer"("vehicle");

-- AddForeignKey
ALTER TABLE "ProgressiveOffer" ADD CONSTRAINT "ProgressiveOffer_vehicle_fkey" FOREIGN KEY ("vehicle") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

