export function vehicleConditionLabel(condition: string) {
  return condition === 'certified' ? 'Certificado' : condition === 'new' ? '0 km' : 'Usado'
}

export type VehicleStatusTone = 'ok' | 'warn' | 'bad' | 'idle'

const STATUS: Record<string, { label: string; tone: VehicleStatusTone }> = {
  available: { label: 'Disponible', tone: 'ok' },
  pending: { label: 'Venta en curso', tone: 'warn' },
  hold: { label: 'En espera', tone: 'warn' },
  reserved: { label: 'Reservado', tone: 'warn' },
  service: { label: 'En preparación', tone: 'idle' },
  sold: { label: 'Vendido', tone: 'bad' },
}

export function vehicleStatus(status: string): { label: string; tone: VehicleStatusTone } {
  return STATUS[status] ?? { label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'No publicado', tone: 'idle' }
}
