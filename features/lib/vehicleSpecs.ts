// Especificaciones de vehículos para Elvis Automotores (combustible, transmisión, cilindrada).
export const FUEL_OPTIONS = [
  { value: 'nafta', label: 'Gasolina' },
  { value: 'diesel', label: 'Diésel' },
  { value: 'gnc', label: 'GNC' },
  { value: 'nafta-gnc', label: 'Gasolina / GNC' },
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

// ---------- Estado del usado (informe que ve el comprador) ----------
export const DEBT_OPTIONS = [
  { label: 'Sin deuda', value: 'sin_deuda' },
  { label: 'Con deuda (se informa abajo)', value: 'con_deuda' },
  { label: 'A verificar', value: 'a_verificar' },
] as const
export const FINES_OPTIONS = [
  { label: 'Sin infracciones', value: 'sin_infracciones' },
  { label: 'Con infracciones (se informa abajo)', value: 'con_infracciones' },
  { label: 'A verificar', value: 'a_verificar' },
] as const
export const GNC_OPTIONS = [
  { label: 'No tiene', value: 'no' },
  { label: 'Tiene equipo de GNC', value: 'si' },
] as const
export const AC_OPTIONS = [
  { label: 'Funciona', value: 'funciona' },
  { label: 'No funciona', value: 'no_funciona' },
  { label: 'No tiene', value: 'no_tiene' },
] as const

const label = (options: readonly { label: string; value: string }[], value?: string | null) =>
  options.find((option) => option.value === value)?.label.replace(/ \(se informa abajo\)$/, '') ?? ''
export const debtLabel = (value?: string | null) => label(DEBT_OPTIONS, value)
export const finesLabel = (value?: string | null) => label(FINES_OPTIONS, value)
export const gncLabel = (value?: string | null) => label(GNC_OPTIONS, value)
export const acLabel = (value?: string | null) => label(AC_OPTIONS, value)

/** Campos del informe del usado, en el orden en que se muestran. */
export const USED_REPORT_TEXT_FIELDS = [
  ['usedEngine', 'Motor'],
  ['usedMechanical', 'Mecánica'],
  ['usedBody', 'Chapa'],
  ['usedPaint', 'Pintura'],
  ['usedPlastics', 'Plásticos y ópticas'],
  ['usedInterior', 'Interior'],
  ['usedFunctional', 'Funcionamiento (levantavidrios, luces, tablero, etc.)'],
  ['usedWheels', 'Llantas'],
] as const
