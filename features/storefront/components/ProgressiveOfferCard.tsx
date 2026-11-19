'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, Flame } from 'lucide-react'
import { offerDay, offerSchedule, offerState, offerTime } from '@/features/lib/progressiveOffer'

const shortDay = (date: Date) => date.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'short', day: 'numeric', month: 'numeric' }).replace(/-/g, '/').replace(',', '')
import { formatPrice } from '../lib/format'
import { useStorefrontBusiness } from './StorefrontBusinessProvider'
import { WhatsAppButton } from './WhatsAppButton'

export type PublicProgressiveOffer = {
  id: string
  number: number | null
  title: string
  imageUrl: string | null
  vehicleId: string | null
  startsAt: string
  startPriceCents: number
  stepCents: number
  stepMinutes: number
  floorPriceCents: number
  status: string
  phase: string
  financing: string
  conditions: string
  includesTransfer: boolean
  walkIn: boolean
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

function countdown(to: Date, now: Date) {
  const total = Math.max(0, Math.floor((to.getTime() - now.getTime()) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const d = Math.floor(h / 24)
  if (d > 0) return `${d} d ${h % 24} h ${String(m).padStart(2, '0')} min`
  return `${h > 0 ? `${h} h ` : ''}${String(m).padStart(2, '0')} min ${String(s).padStart(2, '0')} s`
}

export function ProgressiveOfferCard({ offer, compact = false }: { offer: PublicProgressiveOffer; compact?: boolean }) {
  const business = useStorefrontBusiness()
  const now = useNow()
  const price = (cents: number) => (cents <= 0 ? 'GRATIS' : formatPrice(cents / 100, business.currencyCode || 'ARS'))
  // Antes de montar, se usa la fase calculada en el servidor (sin hora del navegador).
  const state = now ? offerState(offer, now) : null
  const phase = state?.phase ?? offer.phase
  const schedule = offerSchedule(offer)
  const multiDay = schedule.length > 1 && shortDay(schedule[0].at) !== shortDay(schedule[schedule.length - 1].at)
  const stepLabel = (date: Date) => (multiDay ? `${shortDay(date)} ${offerTime(date)}` : offerTime(date))
  const title = `${offer.number != null ? `Oferta progresiva N${offer.number} · ` : 'Oferta progresiva · '}${offer.title}`
  const currentPrice = state && state.priceCents != null ? state.priceCents : null
  const message = `Hola ${business.shortName}, me interesa la ${title}${currentPrice != null && phase === 'live' ? `. Precio actual: ${price(currentPrice)}` : ''}.`

  return (
    <article className="elv-panel !p-0 overflow-hidden" aria-labelledby={`offer-${offer.id}`}>
      <div className={`grid ${compact ? '' : 'lg:grid-cols-[1.1fr_1fr]'}`}>
        {offer.imageUrl && (
          <div className="relative aspect-[4/3] bg-black lg:aspect-auto lg:min-h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={offer.imageUrl} alt={offer.title} className="absolute inset-0 size-full object-cover" loading="lazy" />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.75rem] font-bold uppercase" style={{ background: 'var(--sf-gold-gradient)', color: 'var(--sf-accent-ink)' }}>
              <Flame className="size-3.5" aria-hidden="true" /> Oferta progresiva
            </span>
          </div>
        )}
        <div className="flex flex-col gap-4 p-6 md:p-8">
          <div>
            <p className="elv-eyebrow">{offer.number != null ? `Oferta progresiva N${offer.number}` : 'Oferta progresiva'}</p>
            <h3 id={`offer-${offer.id}`} className="sf-display mt-2 text-[clamp(1.3rem,2.4vw,1.8rem)]">{offer.title}</h3>
          </div>

          <div className="sf-well p-4" aria-live="polite">
            {phase === 'upcoming' && (
              <>
                <p className="sf-label">Empieza el {offerDay(new Date(offer.startsAt))} a las {offerTime(new Date(offer.startsAt))} h</p>
                <p className="sf-price text-[2rem]">{price(offer.startPriceCents)}</p>
                {now && <p className="sf-muted text-[length:var(--sf-text-sm)]"><Clock className="mr-1 inline size-4" aria-hidden="true" />Faltan {countdown(new Date(offer.startsAt), now)}</p>}
              </>
            )}
            {phase === 'live' && state?.phase === 'live' && (
              <>
                <p className="sf-label">Precio ahora</p>
                <p className="sf-price text-[2.4rem]">{price(state.priceCents)}</p>
                {state.nextDropAt && now && (
                  <p className="text-[length:var(--sf-text-sm)]" style={{ color: 'var(--sf-accent)' }}>
                    <Clock className="mr-1 inline size-4" aria-hidden="true" />Baja a {price(state.nextPriceCents ?? 0)} en {countdown(state.nextDropAt, now)} ({stepLabel(state.nextDropAt)} h)
                  </p>
                )}
              </>
            )}
            {phase === 'live' && !state && <p className="sf-label">Oferta en curso</p>}
            {phase === 'final' && state?.phase === 'final' && (
              <>
                <p className="sf-label">Precio final</p>
                <p className="sf-price text-[2.4rem]">{price(state.priceCents)}</p>
              </>
            )}
            {phase === 'sold' && <p className="sf-price text-[1.6rem]">VENDIDA</p>}
          </div>

          {!compact && (
            <details className="text-[length:var(--sf-text-sm)]" open={phase !== 'sold'}>
              <summary className="cursor-pointer font-semibold">Cronograma de precios {multiDay ? `(desde el ${offerDay(new Date(offer.startsAt))})` : `(${offerDay(new Date(offer.startsAt))})`}</summary>
              <ol className={`mt-3 grid gap-x-6 gap-y-1 ${multiDay ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                {schedule.map((step) => {
                  const current = state?.phase === 'live' && state.priceCents === step.priceCents
                  return (
                    <li key={step.at.toISOString()} className="flex justify-between gap-2 border-b py-1 tabular-nums" style={{ borderColor: 'var(--sf-rule)', color: current ? 'var(--sf-accent)' : undefined, fontWeight: current ? 700 : undefined }}>
                      <span className="whitespace-nowrap">{stepLabel(step.at)}</span><span className="whitespace-nowrap">{price(step.priceCents)}</span>
                    </li>
                  )
                })}
              </ol>
            </details>
          )}

          {!compact && (offer.financing || offer.conditions || offer.includesTransfer || offer.walkIn) && (
            <ul className="space-y-1.5 text-[length:var(--sf-text-sm)]" style={{ color: 'var(--sf-ink-2)' }}>
              {offer.includesTransfer && <li>✔ El precio incluye la transferencia: se entrega transferido.</li>}
              {offer.walkIn && <li>✔ Para esta promo puedes venir sin cita.</li>}
              <li>✔ Hasta agotar stock (1 unidad): si se vende, termina la promo.</li>
              <li>✔ El precio baja {offer.stepMinutes % 1440 === 0 ? (offer.stepMinutes === 1440 ? 'cada día' : `cada ${offer.stepMinutes / 1440} días`) : offer.stepMinutes % 60 === 0 ? (offer.stepMinutes === 60 ? 'cada hora' : `cada ${offer.stepMinutes / 60} horas`) : `cada ${offer.stepMinutes} minutos`} que no se vende.</li>
              {offer.financing && <li className="whitespace-pre-line">💳 {offer.financing}</li>}
              {offer.conditions && <li className="whitespace-pre-line">⚠️ {offer.conditions}</li>}
            </ul>
          )}

          <div className="mt-auto flex flex-wrap gap-3">
            {phase !== 'sold' && <WhatsAppButton label="Consultar por WhatsApp" message={message} className="sf-btn sf-btn-primary rounded-[8px]" />}
            {offer.vehicleId && <Link href={`/inventory/${offer.vehicleId}`} className="sf-btn sf-btn-ghost rounded-[8px]">Ver publicación</Link>}
            {compact && <Link href="/ofertas" className="sf-btn sf-btn-ghost rounded-[8px]">Ver cronograma</Link>}
          </div>
        </div>
      </div>
    </article>
  )
}
