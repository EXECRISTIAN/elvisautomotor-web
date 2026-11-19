import type { DeskTone } from '@/features/platform/components/desk'

export const ACQUISITION_STATUSES = ['appraised', 'approved', 'purchased', 'arrived', 'reconditioning', 'frontline', 'cancelled'] as const
export type AcquisitionStatus = typeof ACQUISITION_STATUSES[number]

export const ACQUISITION_SOURCES = ['trade-in', 'auction', 'wholesale', 'consumer-purchase', 'oem-distributor', 'dealer-transfer'] as const

export const acquisitionSourceLabels: Record<string, string> = {
  'trade-in': 'Toma de usado',
  auction: 'Subasta',
  wholesale: 'Mayorista',
  'consumer-purchase': 'Comprado a particular',
  'oem-distributor': 'Fábrica / distribuidor',
  'dealer-transfer': 'Transferencia entre agencias',
}

export const acquisitionStatusLabels: Record<string, string> = {
  appraised: 'Tasado',
  approved: 'Aprobado',
  purchased: 'Comprado',
  arrived: 'Recibido',
  reconditioning: 'En preparación',
  frontline: 'En exhibición',
  cancelled: 'Cancelado',
}

export const acquisitionStatusTones: Record<string, DeskTone> = {
  appraised: 'info',
  approved: 'info',
  purchased: 'warn',
  arrived: 'warn',
  reconditioning: 'warn',
  frontline: 'ok',
  cancelled: 'idle',
}

/** Mirrors lifecycle/inventoryAcquisitionLifecycle.ts. */
export const ACQUISITION_NEXT: Record<string, string | null> = {
  appraised: 'approved',
  approved: 'purchased',
  purchased: 'arrived',
  arrived: 'reconditioning',
  reconditioning: 'frontline',
  frontline: null,
  cancelled: null,
}

export const acquisitionActionLabels: Record<string, string> = {
  approved: 'Aprobar',
  purchased: 'Registrar compra',
  arrived: 'Marcar recibido',
  reconditioning: 'Enviar a preparación',
  frontline: 'Pasar a exhibición',
  cancelled: 'Cancelar',
}

export const RECON_CATEGORIES = ['mechanical', 'body', 'detail', 'tires', 'inspection', 'other'] as const

export const reconCategoryLabels: Record<string, string> = {
  mechanical: 'Mecánica',
  body: 'Chapa y pintura',
  detail: 'Lavado / detalle',
  tires: 'Neumáticos',
  inspection: 'Inspección / VTV',
  other: 'Otro',
}

export const reconStatusLabels: Record<string, string> = {
  open: 'Abierto',
  'in-progress': 'En curso',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

export const reconStatusTones: Record<string, DeskTone> = {
  open: 'info',
  'in-progress': 'warn',
  completed: 'ok',
  cancelled: 'idle',
}

export const COST_TYPES = ['reconditioning', 'transport', 'auction-fee', 'detail', 'other'] as const

export const costTypeLabels: Record<string, string> = {
  reconditioning: 'Preparación',
  transport: 'Traslado',
  'auction-fee': 'Comisión de subasta',
  detail: 'Lavado / detalle',
  other: 'Otro',
}

export const merchandisingStatusLabels: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Esperando aprobación',
  approved: 'Aprobado',
  rejected: 'Rechazado',
}

export const merchandisingStatusTones: Record<string, DeskTone> = {
  draft: 'idle',
  submitted: 'info',
  approved: 'ok',
  rejected: 'bad',
}

export const feedStatusLabels: Record<string, string> = {
  'not-published': 'No publicado',
  succeeded: 'Publicado',
  partial: 'Publicado en parte',
  failed: 'Falló',
}

export const feedStatusTones: Record<string, DeskTone> = {
  'not-published': 'idle',
  succeeded: 'ok',
  partial: 'warn',
  failed: 'bad',
}

export const feedChannelLabels: Record<string, string> = {
  'public-inventory-feed': 'Feed público de inventario',
  'manual-marketplace-export': 'Exportación a portales',
}

export const vehicleStatusLabels: Record<string, string> = {
  available: 'Disponible',
  prep: 'En preparación',
  pending: 'Señado / pendiente',
  hold: 'Reservado',
  service: 'En taller',
  sold: 'Vendido',
}

export const vehicleStatusTones: Record<string, DeskTone> = {
  available: 'ok',
  prep: 'info',
  pending: 'warn',
  hold: 'info',
  service: 'idle',
  sold: 'accent',
}

export const CONDITIONS = ['new', 'used', 'certified'] as const

export const conditionLabels: Record<string, string> = {
  new: '0 km',
  used: 'Usado',
  certified: 'Usado certificado',
}

export const RATINGS = ['excellent', 'good', 'fair', 'poor'] as const

export const ratingLabels: Record<string, string> = {
  excellent: 'Excelente',
  good: 'Bueno',
  fair: 'Regular',
  poor: 'Malo',
}

export const dealStatusLabels: Record<string, string> = {
  pencil: 'Borrador',
  submitted: 'Enviada',
  approved: 'Aprobado',
  financed: 'Financiada',
  delivered: 'Entregada',
  cancelled: 'Cancelado',
}

/** "merchandising-draft-updated" -> "Merchandising draft updated"; "cost:transport" -> "Cost: transport". */
export function eventTypeLabel(value: string) {
  const [head, tail] = value.split(':')
  const words = head.replace(/-/g, ' ')
  const label = words.charAt(0).toUpperCase() + words.slice(1)
  return tail ? `${label}: ${tail.replace(/-/g, ' ')}` : label
}

/** VIN check used by every inventory form: 17 characters, no I, O or Q. */
export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/

export function formatMoneyCents(cents: number | null | undefined, currencyCode = 'ARS') {
  if (cents == null) return '-'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: currencyCode, maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100)
}

export function formatDateTime(value: string | null | undefined, timeZone: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('es-AR', { timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function formatDate(value: string | null | undefined, timeZone: string) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('es-AR', { timeZone, month: 'short', day: 'numeric', year: 'numeric' })
}

export function personName(person: { name: string | null } | null | undefined) {
  return person?.name || 'Sistema'
}
