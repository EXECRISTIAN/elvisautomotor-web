import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTerms, simulate, type PlanTerms } from './simulate'

const plan: PlanTerms = { tnaBps: 6000, termsMonths: [12, 24, 36], minAmountCents: 100_000_00, maxAmountCents: 50_000_000_00, maxFinancedBps: 8000, amortization: 'frances' }

test('sistema francés: cuota fija conocida', () => {
  // $10.000.000 al 60 % TNA (5 % mensual) en 12 cuotas -> 1.128.254,10
  const r = simulate(plan, { priceCents: 20_000_000_00, downPaymentCents: 10_000_000_00, termMonths: 12 })
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal(r.financedCents, 10_000_000_00)
    assert.equal(r.firstInstallmentCents, 112825410)
    assert.equal(r.firstInstallmentCents, r.lastInstallmentCents)
  }
})

test('sistema alemán: primera cuota mayor que la última', () => {
  const r = simulate({ ...plan, amortization: 'aleman' }, { priceCents: 20_000_000_00, downPaymentCents: 10_000_000_00, termMonths: 12 })
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal(r.firstInstallmentCents, Math.round(10_000_000_00 / 12 + 10_000_000_00 * 0.05))
    assert.ok(r.firstInstallmentCents > r.lastInstallmentCents)
  }
})

test('respeta porcentaje financiable, montos y plazos', () => {
  assert.equal(simulate(plan, { priceCents: 10_000_000_00, downPaymentCents: 1_000_000_00, termMonths: 12 }).ok, false) // 90 % > 80 %
  assert.equal(simulate(plan, { priceCents: 10_000_000_00, downPaymentCents: 5_000_000_00, termMonths: 18 }).ok, false) // plazo no ofrecido
  assert.equal(simulate(plan, { priceCents: 10_000_000_00, downPaymentCents: 10_000_000_00, termMonths: 12 }).ok, false) // nada que financiar
  assert.equal(simulate({ ...plan, tnaBps: 0 }, { priceCents: 1_200_000_00, downPaymentCents: 600_000_00, termMonths: 12 }).ok, true)
})

test('parseTerms', () => {
  assert.deepEqual(parseTerms('36, 12,24 24 x 200'), [12, 24, 36])
})
