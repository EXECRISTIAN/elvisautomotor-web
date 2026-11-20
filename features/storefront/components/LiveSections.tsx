'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { FeaturedVehicleCard } from './FeaturedVehicleCard'
import { VehicleCard } from './VehicleCard'
import { useLiveVehicles } from './LiveVehicles'
import type { Vehicle } from '../lib/types'

const AVAILABLE = { status: { equals: 'available' } }

/** Ofertas express (precio anterior tachado). */
export function ExpressOffersGrid({ initial }: { initial: Vehicle[] }) {
  const { items } = useLiveVehicles(initial, { AND: [AVAILABLE, { expressOffer: { equals: true } }] }, 24, [{ priceCents: 'asc' }])
  return items.length > 0 ? (
    <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}
    </div>
  ) : (
    <div className="sf-well mt-8 p-6" role="status">
      <p className="font-semibold">No hay ofertas express en curso en este momento.</p>
      <p className="sf-muted mt-1 text-[length:var(--sf-text-sm)]">Cuando bajemos el precio de un auto, aparece acá. También las avisamos en el canal de WhatsApp.</p>
    </div>
  )
}

/** Destacados del inicio: primero los marcados como destacados, luego los más nuevos. */
export function HomeFeaturedGrid({ initial, currencyCode, empty }: { initial: Vehicle[]; currencyCode: string; empty: React.ReactNode }) {
  const { items } = useLiveVehicles(initial, { AND: [AVAILABLE] }, 100)
  const list = items === initial ? initial : [...items.filter((v) => v.isFeatured), ...items.filter((v) => !v.isFeatured)].slice(0, 4)
  if (!list.length) return <>{empty}</>
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {list.map((vehicle, index) => <FeaturedVehicleCard key={vehicle.id} vehicle={vehicle} currencyCode={currencyCode} priority={index < 2} />)}
    </div>
  )
}

/** Usados seleccionados del inicio (carrusel en celular, grilla desde tablet). */
export function HomeUsedRail({ initial, total, currencyCode }: { initial: Vehicle[]; total: number; currencyCode: string }) {
  const live = useLiveVehicles(initial, { AND: [AVAILABLE, { condition: { equals: 'used' } }] }, 100)
  const items = live.items === initial ? initial : live.items.slice(0, 4)
  const count = live.items === initial ? total : live.total
  if (!items.length) return null
  return (
    <>
      <div className="mt-6">
        <Link href="/inventory?condition=used" className="sf-btn sf-btn-primary min-h-12 rounded-[8px] px-6">
          Ver todos los usados{count > 4 ? ` (${count})` : ''}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="elv-used-rail mt-8" role="list" aria-label="Usados seleccionados">
        {items.map((vehicle) => (
          <div key={vehicle.id} role="listitem" className="elv-used-rail-item">
            <FeaturedVehicleCard vehicle={vehicle} currencyCode={currencyCode} />
          </div>
        ))}
      </div>
    </>
  )
}
