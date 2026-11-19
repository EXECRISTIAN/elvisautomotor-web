import type { Metadata } from 'next'

import type { StorefrontBusiness } from './business'
import { formatMileage, formatPrice, vehicleTitle } from './format'
import { primaryVehicleImage, vehicleImageUrl } from './images'
import type { Vehicle } from './types'

// Shared photo of the showroom used when a page has no picture of its own (link previews).
export const SHARE_PHOTO = '/images/showroom-dusk.jpg'

function place(business: StorefrontBusiness) {
  return business.addressLine2.split(',')[0]?.trim() || ''
}

function oneLine(text: string, max = 160) {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}

/** The shop's description: what the owner wrote, otherwise a plain sentence from its name and town. */
export function businessDescription(business: StorefrontBusiness) {
  if (business.homepageDescription.trim()) return oneLine(business.homepageDescription)
  const town = place(business)
  return oneLine(`${business.fullName}${town ? ` en ${town}` : ''}: autos usados y 0 km, financiación y compra de tu usado.`)
}

const PAGE_DESCRIPTIONS = {
  inventory: (b: StorefrontBusiness) => `Todos los vehículos disponibles en ${b.fullName}, con precio, kilometraje y fotos. Filtrá por marca, modelo, año y presupuesto.`,
  financing: (b: StorefrontBusiness) => `Consultá opciones de financiación para tu próximo vehículo en ${b.fullName}. Sujeto a calificación y aprobación crediticia.`,
} as const

export function pageMetadata(business: StorefrontBusiness, page: keyof typeof PAGE_DESCRIPTIONS, title: string): Metadata {
  const description = oneLine(PAGE_DESCRIPTIONS[page](business))
  return { title, description, openGraph: { title: `${title} | ${business.shortName}`, description } }
}

export function vehicleMetadata(business: StorefrontBusiness, vehicle: Vehicle): Metadata {
  const title = vehicleTitle(vehicle)
  const facts = [
    vehicle.price ? formatPrice(vehicle.price, business.currencyCode) : '',
    vehicle.mileage != null ? formatMileage(vehicle.mileage) : '',
    vehicle.color || '',
    vehicle.stockNumber ? `stock #${vehicle.stockNumber}` : '',
  ].filter(Boolean).join(', ')
  const description = oneLine(`${title}${facts ? `: ${facts}` : ''}. Disponible en ${business.fullName}. Consultá por financiación.`)
  const photo = vehicleImageUrl(primaryVehicleImage(vehicle.images))
  return {
    title,
    description,
    openGraph: { title: `${title} | ${business.shortName}`, description, ...(photo ? { images: [{ url: photo, alt: title }] } : {}) },
    twitter: { card: 'summary_large_image' },
  }
}

/** Defaults for every storefront page; pages override title, description and image. */
export function storefrontMetadata(business: StorefrontBusiness, origin: string | null): Metadata {
  const description = businessDescription(business)
  return {
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    title: { default: business.homepageTitle || business.fullName, template: `%s | ${business.shortName}` },
    description,
    openGraph: {
      type: 'website',
      siteName: business.fullName,
      title: business.homepageTitle || business.fullName,
      description,
      images: [{ url: SHARE_PHOTO, width: 2400, height: 1029, alt: `Salón de ${business.fullName}` }],
    },
    twitter: { card: 'summary_large_image' },
    ...(process.env.DEMO_MODE === 'true' ? { robots: { index: false, follow: false } } : {}),
  }
}
