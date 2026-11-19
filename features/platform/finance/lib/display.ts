import type { DeskTone } from '@/features/platform/components/desk'

export const PRODUCT_CATEGORIES = ['service-contract', 'gap', 'maintenance', 'appearance', 'tire-wheel', 'other'] as const

export const categoryLabels: Record<string, string> = {
  'service-contract': 'Garantía extendida',
  gap: 'GAP',
  maintenance: 'Mantenimiento',
  appearance: 'Estética',
  'tire-wheel': 'Neumáticos y rines',
  other: 'Otro',
}

export function formatCents(cents: number | null | undefined, empty = '-') {
  if (cents == null) return empty
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(cents / 100)
}

export function formatDay(value: string | null | undefined, timeZone: string) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('es-AR', { timeZone, month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(value: string | null | undefined, timeZone: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('es-AR', { timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function formatApr(bps: number | null | undefined) {
  return bps == null ? '-' : `${(bps / 100).toFixed(2)}%`
}

/** Tone for free-form workflow states. */
export function stateTone(value: string | null | undefined): DeskTone {
  const state = (value || '').toLowerCase()
  if (['approved', 'accepted', 'completed', 'complete', 'signed', 'funded', 'quoted', 'submitted-to-lender', 'succeeded', 'active'].includes(state)) return 'ok'
  if (['declined', 'rejected', 'failed', 'expired', 'cancelled', 'canceled', 'void', 'denied'].includes(state)) return 'bad'
  if (['conditional', 'requested', 'pending', 'presented', 'queued', 'submitted', 'under-review', 'creating'].includes(state)) return 'warn'
  return 'idle'
}

export function personName(person: { firstName?: string | null; lastName?: string | null } | null | undefined, fallback = 'No customer') {
  if (!person) return fallback
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || fallback
}

export function vehicleName(vehicle: { year?: number | null; make?: string | null; model?: string | null } | null | undefined, fallback = 'Sin vehículo') {
  if (!vehicle) return fallback
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || fallback
}

export function newIdempotencyKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`
}

/** Whole days since a timestamp; null when unknown. */
export function daysSince(value: string | null | undefined, now = Date.now()) {
  if (!value) return null
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return null
  return Math.max(0, Math.floor((now - time) / 86_400_000))
}

export function formatAge(days: number | null) {
  if (days == null) return '-'
  return days === 0 ? 'Hoy' : `${days} d`
}

export function countLabel(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`
}

/** Desk headline: manager approvals first, then storefront applications still waiting on a lender. */
export function financeDeskStatus({ error, approvalsWaiting, applicationsWaiting }: { error: boolean; approvalsWaiting: number; applicationsWaiting: number }): { tone: DeskTone; label: string } {
  if (error) return { tone: 'bad', label: 'No disponible' }
  if (approvalsWaiting > 0) return { tone: 'warn', label: 'Aprobaciones pendientes' }
  if (applicationsWaiting > 0) return { tone: 'warn', label: `${countLabel(applicationsWaiting, 'solicitud', 'solicitudes')} ${applicationsWaiting === 1 ? 'pendiente' : 'pendientes'}` }
  return { tone: 'ok', label: 'Al día' }
}

// Storefront financing form values (FinancingPage) shown as the customer chose them.
const employmentLabels: Record<string, string> = {
  employed: 'Empleado', 'self-employed': 'Independiente / autónomo', retired: 'Jubilado', student: 'Estudiante', other: 'Otro',
}
const creditTierLabels: Record<string, string> = {
  'excellent-720-plus': 'Muy bueno', 'good-680-719': 'Bueno', 'fair-620-679': 'Regular',
  'rebuilding-under-620': 'Con deudas / en recuperación', unknown: 'No sé',
}
export function employmentLabel(value: string | null | undefined) {
  return value ? employmentLabels[value] || value : '-'
}
export function creditTierLabel(value: string | null | undefined) {
  return value ? creditTierLabels[value] || value : '-'
}
