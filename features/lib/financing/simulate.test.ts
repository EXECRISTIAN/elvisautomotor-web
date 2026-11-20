import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTerms, simulate, type PlanTerms } from './simulate'

const plan: PlanTerms = { tnaBps: 6000, termsMonths: [12, 24, 36], minAmountCents: 100_000_00, maxAmountCents: 50_000_000_00, maxFinancedBps: 8000, amortization: 'frances' }

test('sistema francés: cuota fija conocida', () => {
  // $10.000.000 al 60 % TNA (5 % mensual) en 12 cuotas -> 1.128.254,10 + IVA del 21 % sobre el interés del mes 1 (105.000)
  const r = simulate(plan, { priceCents: 20_000_000_00, downPaymentCents: 10_000_000_00, termMonths: 12 })
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal(r.financedCents, 10_000_000_00)
    assert.equal(r.firstInstallmentCents, 112825410 + 10500000)
    assert.ok(r.firstInstallmentCents > r.lastInstallmentCents) // el IVA baja con el interés
  }
})

test('sistema alemán: primera cuota mayor que la última', () => {
  const r = simulate({ ...plan, amortization: 'aleman' }, { priceCents: 20_000_000_00, downPaymentCents: 10_000_000_00, termMonths: 12 })
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal(r.firstInstallmentCents, Math.round(10_000_000_00 / 12 + 10_000_000_00 * 0.05 * 1.21))
    assert.ok(r.firstInstallmentCents > r.lastInstallmentCents)
  }
})

test('respeta porcentaje financiable, montos y plazos', () => {
  assert.equal(simulate(plan, { priceCents: 10_000_000_00, downPaymentCents: 1_000_000_00, termMonths: 12 }).ok, false) // 90 % > 80 %
  assert.equal(simulate(plan, { priceCents: 10_000_000_00, downPaymentCents: 5_000_000_00, termMonths: 18 }).ok, true) // cantidad personalizada dentro del rango 12–36
  assert.equal(simulate(plan, { priceCents: 10_000_000_00, downPaymentCents: 5_000_000_00, termMonths: 48 }).ok, false) // fuera del rango
  assert.equal(simulate(plan, { priceCents: 10_000_000_00, downPaymentCents: 5_000_000_00, termMonths: 6 }).ok, false) // fuera del rango
  assert.equal(simulate(plan, { priceCents: 10_000_000_00, downPaymentCents: 10_000_000_00, termMonths: 12 }).ok, false) // nada que financiar
  assert.equal(simulate({ ...plan, tnaBps: 0 }, { priceCents: 1_200_000_00, downPaymentCents: 600_000_00, termMonths: 12 }).ok, true)
})

test('parseTerms', () => {
  assert.deepEqual(parseTerms('36, 12,24 24 x 200'), [12, 24, 36])
})

// Ejemplos publicados por Banco Nación (05/11/2026): $15.000.000 a 36 meses, primera cuota con IVA.
test('coincide con el ejemplo de Banco Nación al 25 % y al 46 % TNA', () => {
  const base = { termsMonths: [36], minAmountCents: null, maxAmountCents: null, maxFinancedBps: 10000, amortization: 'frances' as const }
  const a = simulate({ ...base, tnaBps: 2500 }, { priceCents: 1_500_000_000, downPaymentCents: 0, termMonths: 36 })
  const b = simulate({ ...base, tnaBps: 4600 }, { priceCents: 1_500_000_000, downPaymentCents: 0, termMonths: 36 })
  assert.ok(a.ok && b.ok)
  assert.equal(Math.round(a.firstInstallmentCents / 100), 662022)
  assert.equal(Math.round(b.firstInstallmentCents / 100), 895841)
})
