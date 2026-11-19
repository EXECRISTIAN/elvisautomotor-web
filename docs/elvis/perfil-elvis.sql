-- Datos públicos del negocio para el perfil del concesionario (equivale a completarlos en Store Settings).
-- Ejecutar solo en la base de la demo/propuesta.
-- WhatsApp de atención: 11 2723-5886 (lo responde un asistente automático de Meta).
UPDATE "DealershipProfile" SET
  name = 'Elvis Automotores S.R.L.',
  "shortName" = 'Elvis Automotores',
  phone = '(011) 4259-1365',
  "whatsappNumber" = '5491127235886',
  "salesEmail" = 'elvisautomotores@gmail.com',
  "addressLine1" = 'Andrés Baranda 2134',
  "addressLine2" = '',
  city = 'Quilmes',
  state = 'Buenos Aires',
  "postalCode" = '',
  "hoursMonFri" = '9 a 13 h sin turno (por la tarde, solo con turno asignado)',
  "hoursSaturday" = 'Cerrado',
  "hoursSunday" = 'Cerrado',
  "websiteUrl" = 'https://www.elvisautomotores.com',
  "currencyCode" = 'ARS',
  "homepageTitle" = 'Tu próximo auto, más cerca.',
  "homepageDescription" = 'Compra y venta de usados y 0 km desde 2009. Venta a crédito con financiación de hasta el 100% (sujeto a calificación y aprobación crediticia).'
WHERE id = 1;

-- Bancos con los que trabaja Elvis. Se crean SIN planes: las tasas, plazos y condiciones reales
-- las tiene que informar Elvis y se cargan en Panel → Tablas → Planes de financiación.
INSERT INTO "Bank" (id, name, active, website, notes, "providerKey") VALUES
  ('bank_nacion', 'Banco Nación', true, 'https://www.bna.com.ar', '', 'manual'),
  ('bank_provincia', 'Banco Provincia', true, 'https://www.bancoprovincia.com.ar', '', 'manual')
ON CONFLICT (id) DO NOTHING;
