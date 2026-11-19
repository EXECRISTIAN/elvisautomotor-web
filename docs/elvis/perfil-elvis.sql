-- Datos públicos del negocio para el perfil del concesionario (equivale a completarlos en Store Settings).
-- Ejecutar solo en la base de la demo/propuesta. El WhatsApp queda vacío hasta confirmar el número.
UPDATE "DealershipProfile" SET
  name = 'Elvis Automotores S.R.L.',
  "shortName" = 'Elvis Automotores',
  phone = '(011) 4259-1365',
  "salesEmail" = 'elvisautomotores@gmail.com',
  "addressLine1" = 'Andrés Baranda 2134',
  "addressLine2" = '',
  city = 'Quilmes',
  state = 'Buenos Aires',
  "postalCode" = '',
  "hoursMonFri" = '9 a 13 h (por la tarde, solo con turno previo)',
  "hoursSaturday" = 'Cerrado',
  "hoursSunday" = 'Cerrado',
  "websiteUrl" = 'https://www.elvisautomotores.com',
  "currencyCode" = 'ARS',
  "homepageTitle" = 'Tu próximo auto, más cerca.',
  "homepageDescription" = 'Compra y venta de usados y 0 km desde 2009. Venta a crédito con financiación de hasta el 100% (sujeto a calificación y aprobación crediticia).'
WHERE id = 1;
