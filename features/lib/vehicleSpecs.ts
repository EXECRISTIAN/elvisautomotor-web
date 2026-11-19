// Especificaciones de vehículos para Elvis Automotores (combustible, transmisión, cilindrada).
export const FUEL_OPTIONS = [
  { value: 'nafta', label: 'Nafta' },
  { value: 'diesel', label: 'Diésel' },
  { value: 'gnc', label: 'GNC' },
  { value: 'nafta-gnc', label: 'Nafta / GNC' },
  { value: 'hibrido', label: 'Híbrido' },
  { value: 'electrico', label: 'Eléctrico' },
] as const

export const TRANSMISSION_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'automatica', label: 'Automática' },
] as const

const FUELS = new Set<string>(FUEL_OPTIONS.map(option => option.value))
const TRANSMISSIONS = new Set<string>(TRANSMISSION_OPTIONS.map(option => option.value))

export function fuelLabel(value?: string | null) {
  return FUEL_OPTIONS.find(option => option.value === value)?.label || ''
}

export function transmissionLabel(value?: string | null) {
  return TRANSMISSION_OPTIONS.find(option => option.value === value)?.label || ''
}

/** Valida y normaliza las especificaciones. Vacío = no informado. */
export function normalizeVehicleSpecs(data: { fuelType?: unknown; transmission?: unknown; engine?: unknown }) {
  const fuelType = String(data.fuelType ?? '').trim().toLowerCase()
  if (fuelType && !FUELS.has(fuelType)) throw new Error('Tipo de combustible inválido')
  const transmission = String(data.transmission ?? '').trim().toLowerCase()
  if (transmission && !TRANSMISSIONS.has(transmission)) throw new Error('Transmisión inválida')
  const engine = String(data.engine ?? '').trim()
  if (engine.length > 40) throw new Error('La cilindrada/motor debe tener como máximo 40 caracteres')
  return { fuelType, transmission, engine }
}
