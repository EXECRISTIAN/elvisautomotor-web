import { test } from 'node:test'
import assert from 'node:assert/strict'
import { offerSchedule, offerState, offerTime } from './progressiveOffer'

// Oferta progresiva N7: Meriva 2010, martes 10/11/2026 desde las 9:01 (Argentina, UTC-3),
// $10.000.000 y baja $1.000.000 por hora hasta llegar a $0 (gratis) a las 19:01.
const n7 = { startsAt: '2026-11-10T09:01:00-03:00', startPriceCents: 10_000_000_00, stepCents: 1_000_000_00, stepMinutes: 60, floorPriceCents: 0 }

test('el cronograma coincide con la publicación de Elvis', () => {
  const steps = offerSchedule(n7)
  assert.equal(steps.length, 11)
  assert.deepEqual(steps.map((s) => offerTime(s.at)), ['09:01', '10:01', '11:01', '12:01', '13:01', '14:01', '15:01', '16:01', '17:01', '18:01', '19:01'])
  assert.deepEqual(steps.map((s) => s.priceCents / 100), [10e6, 9e6, 8e6, 7e6, 6e6, 5e6, 4e6, 3e6, 2e6, 1e6, 0])
})

test('estado según la hora', () => {
  assert.equal(offerState(n7, new Date('2026-11-10T08:00:00-03:00')).phase, 'upcoming')
  const at = offerState(n7, new Date('2026-11-10T12:30:00-03:00'))
  assert.equal(at.phase, 'live')
  if (at.phase === 'live') {
    assert.equal(at.priceCents, 7_000_000_00)
    assert.equal(offerTime(at.nextDropAt!), '13:01')
    assert.equal(at.nextPriceCents, 6_000_000_00)
  }
  assert.deepEqual(offerState(n7, new Date('2026-11-10T19:30:00-03:00')), { phase: 'final', priceCents: 0 })
  assert.equal(offerState({ ...n7, status: 'sold' }, new Date('2026-11-10T12:30:00-03:00')).phase, 'sold')
})

test('también puede bajar por día', () => {
  const daily = { startsAt: '2026-11-16T09:00:00-03:00', startPriceCents: 5_000_000_00, stepCents: 500_000_00, stepMinutes: 1440, floorPriceCents: 3_000_000_00 }
  const steps = offerSchedule(daily)
  assert.deepEqual(steps.map((s) => s.priceCents / 100), [5e6, 4.5e6, 4e6, 3.5e6, 3e6])
  const at = offerState(daily, new Date('2026-11-18T10:00:00-03:00'))
  assert.equal(at.phase, 'live')
  if (at.phase === 'live') assert.equal(at.priceCents, 4_000_000_00)
})
