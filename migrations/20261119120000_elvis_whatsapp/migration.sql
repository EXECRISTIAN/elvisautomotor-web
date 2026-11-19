ALTER TABLE "DealershipProfile" ADD COLUMN "whatsappNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DealershipProfile" ALTER COLUMN "currencyCode" SET DEFAULT 'ARS';
