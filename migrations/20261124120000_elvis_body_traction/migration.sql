-- Tipo de vehículo y tracción (opcionales; si están vacíos la web los deduce del modelo)
ALTER TABLE "Vehicle" ADD COLUMN "carroceria" TEXT,
ADD COLUMN "traccion" TEXT,
ADD COLUMN "tipoTraccion" TEXT;
