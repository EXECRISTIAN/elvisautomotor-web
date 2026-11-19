/** Display helpers shared by the platform desks. */

/** "1 photo", "3 photos"; pass the plural when it is not just the singular plus s. */
export function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

/** Teléfonos argentinos: se muestran tal como se cargaron (el formato de EE.UU. no aplica). */
export function formatPhone(value: string | null | undefined) {
  return String(value ?? '').trim()
}

/**
 * Short, stable reference for a record id, in the storefront's PREFIX-XXXXXXXX
 * shape (see features/storefront/lib/customerRequests.ts).
 */
export function recordReference(prefix: string, id: string | null | undefined) {
  const normalized = String(id ?? '').trim().replace(/[^a-zA-Z0-9]/g, '')
  if (!normalized) return null
  return `${prefix}-${normalized.slice(-8).toUpperCase()}`
}

export const DEFAULT_DEALERSHIP_TIME_ZONE = 'America/New_York'

/** Calendar day of a timestamp in the given zone, e.g. "2026-10-23", for same-day comparisons. */
export function dayKey(value: string | number | Date, timeZone: string) {
  return new Date(value).toLocaleDateString('en-CA', { timeZone })
}
