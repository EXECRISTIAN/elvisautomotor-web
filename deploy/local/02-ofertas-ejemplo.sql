-- Ofertas progresivas de ejemplo. La de prueba arranca HOY a las 9:01 (hora argentina) cada vez que
-- se crea la base, así la demostración siempre tiene una oferta programada o en curso.
INSERT INTO "ProgressiveOffer" (id, number, title, "photoUrl", "startsAt", "startPriceCents", "stepCents", "stepEvery", "stepUnit", "stepMinutes", "floorPriceCents", status, financing, conditions, "includesTransfer", "noAppointment")
VALUES
 ('offer_demo', 8, 'Chevrolet Meriva 2010 gasolina (ejemplo)', '/images/ofertas/meriva-n7.webp',
  (date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') + interval '9 hours 1 minute') AT TIME ZONE 'America/Argentina/Buenos_Aires',
  1000000000, 100000000, 1, 'hours', 60, 0, 'active',
  'Contado o hasta 90% financiado si tienes Banco Provincia aprobado. Anticipo mínimo $500.000 y cuotas. Se entrega con la primera cuota.',
  'Oferta de ejemplo para la demostración. Ideal mecánico, carrocero, reventa. Tomado en Plan Canje, sin inspección y sin garantía. Puedes revisarlo con un mecánico de tu confianza.',
  'included', 'walk-in')
ON CONFLICT (id) DO NOTHING;
-- Ofertas express de ejemplo (datos de demostración): precio anterior tachado.
UPDATE "Vehicle" SET "previousPriceCents" = 2690000000 WHERE make='Fiat' AND model='Cronos' AND year=2026 AND "previousPriceCents" IS NULL;
UPDATE "Vehicle" SET "previousPriceCents" = 3590000000 WHERE make='Chevrolet' AND model='Tracker' AND year=2026 AND "previousPriceCents" IS NULL;
UPDATE "Vehicle" SET "previousPriceCents" = 4890000000 WHERE make='Honda' AND model='CR-V' AND year=2022 AND "previousPriceCents" IS NULL;
UPDATE "Vehicle" SET "previousPriceCents" = 6790000000 WHERE make='Toyota' AND model='Hilux' AND year=2026 AND "previousPriceCents" IS NULL;
