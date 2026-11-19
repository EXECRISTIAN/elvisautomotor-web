const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('la consulta de vehículos de los formularios públicos trae todo lo que entra en la huella de publicación', () => {
  const snapshot = read('features/keystone/lifecycle/inventoryPublication.ts');
  const query = read('features/keystone/mutations/submissionUtils.ts').match(/PUBLIC_SUBMISSION_VEHICLE_QUERY = `([\s\S]*?)`/)[1];
  for (const field of ['fuelType', 'transmission', 'engine', 'exteriorColor', 'interiorColor', 'mileage', 'priceCents', 'listPriceCents', 'features', 'description']) {
    if (snapshot.includes(`v.${field}`)) assert.match(query, new RegExp(`\\b${field}\\b`), `falta ${field}`);
  }
});

test('los importes en centavos son de 64 bits (precios en pesos)', () => {
  const schema = read('schema.prisma');
  assert.equal((schema.match(/^\s+\w*Cents\w*\s+Int\b/gm) || []).length, 0);
});

test('el simulador no tiene tasas fijas inventadas', () => {
  const page = read('features/storefront/screens/FinancingPage.tsx');
  assert.doesNotMatch(page, /DEFAULT_INTEREST_RATE|7\.5/);
});

test('los valores internos de combustible no cambian (solo cambian los textos)', () => {
  const specs = read('features/lib/vehicleSpecs.ts');
  for (const value of ['nafta', 'diesel', 'gnc', 'nafta-gnc', 'hibrido', 'electrico', 'manual', 'automatica']) {
    assert.match(specs, new RegExp(`value: '${value}'`));
  }
});
