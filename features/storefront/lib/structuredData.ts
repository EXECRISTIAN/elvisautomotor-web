// Datos estructurados (JSON-LD, schema.org) para que Google muestre la agencia y cada vehículo
// con dirección, teléfono, redes y precio. Solo usa datos cargados en el panel: nunca inventa.
import type { StorefrontBusiness } from './business'
import type { Vehicle } from './types'
import { ELVIS_LINKS } from './elvisContent'
import { primaryVehicleImage, vehicleImageUrl } from './images'
import { fuelLabel, transmissionLabel } from '@/features/lib/vehicleSpecs'

function absolute(url: string, baseUrl: string | null) {
  if (!url) return undefined
  if (/^https?:\/\//.test(url)) return url
  return baseUrl ? `${baseUrl.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}` : undefined
}

function clean<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== '' && v !== null && !(Array.isArray(v) && v.length === 0)),
  ) as T
}

export function dealerJsonLd(business: StorefrontBusiness, baseUrl: string | null) {
  const phone = business.phoneHref.replace(/^tel:/, '')
  return clean({
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    '@id': baseUrl ? `${baseUrl}/#agencia` : undefined,
    name: business.fullName,
    alternateName: business.shortName !== business.fullName ? business.shortName : undefined,
    url: baseUrl ?? (business.websiteUrl || undefined),
    telephone: phone || undefined,
    email: business.salesEmail || undefined,
    image: absolute('/images/showroom-dusk.jpg', baseUrl),
    address: business.addressLine1
      ? clean({
          '@type': 'PostalAddress',
          streetAddress: business.addressLine1,
          addressLocality: business.addressLine2 || undefined,
          addressCountry: 'AR',
        })
      : undefined,
    hasMap: ELVIS_LINKS.maps,
    sameAs: ELVIS_LINKS.social.map((s) => s.href),
    currenciesAccepted: business.currencyCode || undefined,
  })
}

const AVAILABILITY: Record<string, string> = {
  available: 'https://schema.org/InStock',
  pending: 'https://schema.org/LimitedAvailability',
  sold: 'https://schema.org/SoldOut',
}

export function vehicleJsonLd(business: StorefrontBusiness, vehicle: Vehicle, baseUrl: string | null) {
  const name = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')
  const url = absolute(`/inventory/${vehicle.id}`, baseUrl)
  const image = absolute(vehicleImageUrl(primaryVehicleImage(vehicle.images)) || '', baseUrl)
  const isNew = vehicle.condition === 'new'
  return clean({
    '@context': 'https://schema.org',
    '@type': 'Car',
    name,
    url,
    image,
    brand: { '@type': 'Brand', name: vehicle.make },
    model: vehicle.model,
    vehicleModelDate: String(vehicle.year),
    color: vehicle.color || undefined,
    fuelType: fuelLabel(vehicle.fuelType) || undefined,
    vehicleTransmission: transmissionLabel(vehicle.transmission) || undefined,
    vehicleEngine: vehicle.engine ? { '@type': 'EngineSpecification', name: vehicle.engine } : undefined,
    mileageFromOdometer: isNew ? undefined : { '@type': 'QuantitativeValue', value: vehicle.mileage, unitCode: 'KMT' },
    itemCondition: isNew ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
    description: vehicle.description || undefined,
    offers:
      vehicle.price > 0
        ? clean({
            '@type': 'Offer',
            price: vehicle.price,
            priceCurrency: business.currencyCode || 'ARS',
            availability: AVAILABILITY[vehicle.status] ?? undefined,
            url,
            seller: { '@type': 'AutoDealer', name: business.fullName },
          })
        : undefined,
  })
}

/** Serializa evitando que un texto cargado en el panel pueda cerrar la etiqueta <script>. */
export function jsonLdString(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
