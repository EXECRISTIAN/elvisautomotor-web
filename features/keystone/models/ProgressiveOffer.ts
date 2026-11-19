import { list } from '@keystone-6/core'
import { float, image, integer, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { trackingFields } from './trackingFields'

// "Oferta progresiva": el precio baja un monto fijo cada cierto tiempo hasta un precio final
// (puede ser $0 = gratis). El precio vigente se calcula con features/lib/progressiveOffer.ts.
export const ProgressiveOffer = list({
  access: {
    operation: {
      query: permissions.canManageInventory,
      create: permissions.canManageInventory,
      update: permissions.canManageInventory,
      delete: permissions.canManageInventory,
    },
  },
  hooks: {
    resolveInput: ({ resolvedData, item }: any) => {
      const every = resolvedData.stepEvery ?? item?.stepEvery ?? 1
      const unit = resolvedData.stepUnit ?? item?.stepUnit ?? 'hours'
      const factor = unit === 'days' ? 1440 : unit === 'minutes' ? 1 : 60
      return { ...resolvedData, stepMinutes: Math.max(1, Number(every) * factor) }
    },
    validate: ({ resolvedData, item, addValidationError, operation }: any) => {
      if (operation === 'delete') return
      const start = resolvedData.startPriceCents ?? item?.startPriceCents
      const floor = resolvedData.floorPriceCents ?? item?.floorPriceCents ?? 0
      if (start != null && floor > start) addValidationError('El precio final no puede ser mayor al precio inicial.')
    },
  },
  ui: {
    label: 'Ofertas progresivas',
    singular: 'Oferta progresiva',
    plural: 'Ofertas progresivas',
    listView: { initialColumns: ['number', 'title', 'startsAt', 'startPriceCents', 'status'] },
  },
  fields: {
    ...trackingFields,
    number: integer({ label: 'Número de oferta', ui: { description: 'Ej.: 7 para "Oferta progresiva N7"' } }),
    title: text({ label: 'Vehículo (título)', validation: { isRequired: true }, ui: { description: 'Ej.: Chevrolet Meriva 2010 nafta' } }),
    vehicle: relationship({ ref: 'Vehicle', label: 'Vehículo del inventario (opcional)', ui: { displayMode: 'select', labelField: 'stockNumber' } }),
    photo: image({ storage: 'my_images', label: 'Foto' }),
    photoUrl: text({ label: 'Foto (URL)', ui: { description: 'Alternativa a subir la foto: una URL https o una ruta /images/...' } }),
    startsAt: timestamp({ label: 'Empieza', validation: { isRequired: true } }),
    startPriceCents: float({ label: 'Precio inicial (centavos)', validation: { isRequired: true, min: 0 } }),
    stepCents: float({ label: 'Baja por paso (centavos)', validation: { isRequired: true, min: 0 } }),
    stepEvery: integer({ label: 'Baja cada…', defaultValue: 1, validation: { isRequired: true, min: 1, max: 365 } }),
    stepUnit: select({
      label: '…unidad',
      type: 'string',
      defaultValue: 'hours',
      validation: { isRequired: true },
      options: [
        { label: 'Horas', value: 'hours' },
        { label: 'Días', value: 'days' },
        { label: 'Minutos', value: 'minutes' },
      ],
    }),
    // Calculado a partir de "Baja cada…" y la unidad.
    stepMinutes: integer({ label: 'Intervalo en minutos (automático)', defaultValue: 60, ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } } }),
    floorPriceCents: float({ label: 'Precio final (centavos, 0 = gratis)', defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    status: select({
      label: 'Estado',
      type: 'string',
      defaultValue: 'active',
      validation: { isRequired: true },
      options: [
        { label: 'Activa / programada', value: 'active' },
        { label: 'Vendida', value: 'sold' },
        { label: 'Cancelada', value: 'cancelled' },
      ],
    }),
    soldAt: timestamp({ label: 'Vendida el' }),
    financing: text({ label: 'Financiación', ui: { displayMode: 'textarea', description: 'Ej.: Contado o hasta 90% financiado con Banco Provincia aprobado. Anticipo mínimo $500.000.' } }),
    conditions: text({ label: 'Condiciones y aclaraciones', ui: { displayMode: 'textarea', description: 'Ej.: Tomado en Plan Canje, sin inspección y sin garantía. Precio con transferencia incluida.' } }),
    includesTransfer: select({ label: 'Transferencia', type: 'string', defaultValue: 'included', options: [{ label: 'Incluida (se entrega transferido)', value: 'included' }, { label: 'No incluida', value: 'excluded' }] }),
    noAppointment: select({ label: 'Turno', type: 'string', defaultValue: 'walk-in', options: [{ label: 'Se puede venir sin turno', value: 'walk-in' }, { label: 'Con turno', value: 'appointment' }] }),
  },
})
