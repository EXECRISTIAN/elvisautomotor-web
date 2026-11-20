import { formatPrice } from '../lib/format'

/** Precio anterior tachado de una oferta express (solo si es mayor al precio actual). */
export function PreviousPrice({ previous, price, currencyCode, className = '' }: { previous?: number | null; price?: number | null; currencyCode?: string | null; className?: string }) {
  if (!previous || !price || previous <= price) return null
  const pct = Math.round((1 - price / previous) * 100)
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 ${className}`}>
      <s className="tabular-nums opacity-70" aria-label={`Antes ${formatPrice(previous, currencyCode)}`}>{formatPrice(previous, currencyCode)}</s>
      {pct > 0 && <span className="rounded-[4px] px-1.5 py-0.5 text-[0.7rem] font-bold" style={{ background: 'var(--sf-gold-gradient)', color: 'var(--sf-accent-ink)' }}>−{pct} %</span>}
    </span>
  )
}

export const isExpressOffer = (vehicle: { previousPrice?: number | null; price?: number | null }) =>
  Boolean(vehicle.previousPrice && vehicle.price && vehicle.previousPrice > vehicle.price)
