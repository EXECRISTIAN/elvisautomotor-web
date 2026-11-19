// "Oferta progresiva" de Elvis Automotores: el precio baja un monto fijo cada cierto tiempo
// desde la hora de inicio hasta un precio final (que puede ser $0 = "gratis"). Función pura,
// usada por el servidor y por el navegador (cuenta regresiva en vivo).

export type ProgressiveOfferTerms = {
  startsAt: string | Date
  startPriceCents: number
  stepCents: number
  stepMinutes: number
  floorPriceCents: number
  status?: string | null // 'active' | 'sold' | 'cancelled'
}

export type OfferStep = { at: Date; priceCents: number }

export type OfferState =
  | { phase: 'upcoming'; priceCents: number; startsAt: Date }
  | { phase: 'live'; priceCents: number; nextDropAt: Date | null; nextPriceCents: number | null }
  | { phase: 'final'; priceCents: number } // llegó al precio final y sigue disponible
  | { phase: 'sold' | 'cancelled'; priceCents: null }

export function offerSchedule(offer: ProgressiveOfferTerms): OfferStep[] {
  const start = new Date(offer.startsAt)
  const steps: OfferStep[] = []
  const stepMs = Math.max(1, offer.stepMinutes) * 60_000
  const step = Math.max(0, offer.stepCents)
  let price = offer.startPriceCents
  for (let i = 0; i < 500; i++) {
    steps.push({ at: new Date(start.getTime() + i * stepMs), priceCents: price })
    if (price <= offer.floorPriceCents || step === 0) break
    price = Math.max(offer.floorPriceCents, price - step)
  }
  return steps
}

export function offerState(offer: ProgressiveOfferTerms, now: Date = new Date()): OfferState {
  if (offer.status === 'sold') return { phase: 'sold', priceCents: null }
  if (offer.status === 'cancelled') return { phase: 'cancelled', priceCents: null }
  const steps = offerSchedule(offer)
  if (now < steps[0].at) return { phase: 'upcoming', priceCents: steps[0].priceCents, startsAt: steps[0].at }
  let index = 0
  while (index + 1 < steps.length && steps[index + 1].at <= now) index++
  const current = steps[index]
  const next = steps[index + 1] ?? null
  if (!next) return { phase: 'final', priceCents: current.priceCents }
  return { phase: 'live', priceCents: current.priceCents, nextDropAt: next.at, nextPriceCents: next.priceCents }
}

/** "10:01" en hora argentina. */
export function offerTime(date: Date) {
  return date.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false })
}

export function offerDay(date: Date) {
  return date.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long' })
}
