import Image from 'next/image'
import Link from 'next/link'
import { Gauge } from 'lucide-react'
import type { Vehicle } from '../lib/types'
import { formatMileage, formatPrice } from '../lib/format'
import { primaryVehicleImage, skipImageOptimizer, vehicleImageUrl } from '../lib/images'
import { VehiclePhotoPlaceholder } from './VehiclePhotoPlaceholder'

// Tarjeta clara de vehículo destacado (home), según la referencia visual de Elvis.
export function FeaturedVehicleCard({ vehicle, currencyCode, priority = false }: { vehicle: Vehicle; currencyCode: string; priority?: boolean }) {
  const image = vehicleImageUrl(primaryVehicleImage(vehicle.images))
  const name = [vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')

  return (
    <Link href={`/inventory/${vehicle.id}`} className="elv-car-card group">
      <span className="elv-car-photo">
        {image ? (
          <Image src={image} alt="" fill unoptimized={skipImageOptimizer(image)} priority={priority} sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
        ) : (
          <VehiclePhotoPlaceholder />
        )}
        {vehicle.year ? <span className="elv-year-badge">{vehicle.year}</span> : null}
      </span>
      <span className="flex flex-1 flex-col gap-2 p-4">
        <span className="line-clamp-2 text-[0.95rem] font-bold uppercase leading-snug tracking-[0.02em]">{name}</span>
        {Number.isFinite(vehicle.mileage) && (
          <span className="flex items-center gap-1.5 text-[0.75rem] font-medium uppercase" style={{ color: 'var(--elv-cream-ink-2)' }}>
            <Gauge className="size-3.5" aria-hidden="true" />
            {formatMileage(vehicle.mileage)}
          </span>
        )}
        <span className="mt-auto pt-2 text-right text-[1.15rem] font-bold tabular-nums">
          {vehicle.price > 0 ? formatPrice(vehicle.price, currencyCode) : 'Consultar precio'}
        </span>
      </span>
    </Link>
  )
}
