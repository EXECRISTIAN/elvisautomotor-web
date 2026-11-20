/** Display helpers shared by the platform desks. */

/** "1 photo", "3 photos"; pass the plural when it is not just the singular plus s. */
// Sustantivos heredados del panel original (en inglés) → español [singular, plural].
const COUNT_ES: Record<string, [string, string]> = {
  photo: ['foto', 'fotos'], part: ['repuesto', 'repuestos'], lead: ['consulta', 'consultas'],
  unit: ['unidad', 'unidades'], 'service package': ['paquete de servicio', 'paquetes de servicio'],
  run: ['ejecución', 'ejecuciones'], role: ['rol', 'roles'], provider: ['proveedor', 'proveedores'],
  'open RO': ['orden abierta', 'órdenes abiertas'], model: ['modelo', 'modelos'], mapping: ['correspondencia', 'correspondencias'],
  make: ['marca', 'marcas'], day: ['día', 'días'], batch: ['lote', 'lotes'], attempt: ['intento', 'intentos'],
  appointment: ['cita', 'citas'], 'active saved report': ['reporte guardado activo', 'reportes guardados activos'],
  'active routing rule': ['regla de asignación activa', 'reglas de asignación activas'],
  'active rooftop': ['sucursal activa', 'sucursales activas'], 'active member': ['integrante activo', 'integrantes activos'],
  RO: ['orden', 'órdenes'], PO: ['orden de compra', 'órdenes de compra'], deal: ['operación', 'operaciones'],
  member: ['integrante', 'integrantes'], vehicle: ['vehículo', 'vehículos'], report: ['reporte', 'reportes'],
  'pending invite': ['invitación pendiente', 'invitaciones pendientes'],
}

export function countLabel(count: number, singular: string, plural?: string) {
  const es = plural === undefined ? COUNT_ES[singular] : undefined
  const one = es ? es[0] : singular
  const many = es ? es[1] : plural ?? `${singular}s`
  return `${count} ${count === 1 ? one : many}`
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

export const DEFAULT_DEALERSHIP_TIME_ZONE = 'America/Argentina/Buenos_Aires'

/** Calendar day of a timestamp in the given zone, e.g. "2026-10-23", for same-day comparisons. */
export function dayKey(value: string | number | Date, timeZone: string) {
  return new Date(value).toLocaleDateString('en-CA', { timeZone })
}
