import { list } from '@keystone-6/core'
import { checkbox, float, integer, relationship, select, text, timestamp } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { parseTerms } from '../../lib/financing/simulate'
import { trackingFields } from './trackingFields'

// Productos de financiación cargados por Elvis. Solo los activos y vigentes se muestran en la web.
// Las tasas se guardan en puntos básicos (85,5 % = 8550) y los montos en centavos.
const bps = (label: string, description: string, isRequired = false) =>
  integer({ label, validation: { isRequired, min: 0, max: 100_000 }, ui: { description } })

export const FinancingPlan = list({
  access: {
    operation: {
      query: permissions.canManageFinancing,
      create: permissions.canManageFinancing,
      update: permissions.canManageFinancing,
      delete: permissions.canManageFinancing,
    },
  },
  hooks: {
    validate: ({ resolvedData, item, addValidationError, operation }: any) => {
      if (operation === 'delete') return
      const terms = resolvedData.termsMonths ?? item?.termsMonths
      if (!parseTerms(terms).length) addValidationError('Cargá al menos un plazo en meses (por ejemplo: 12, 24, 36).')
      const min = resolvedData.minAmountCents ?? item?.minAmountCents
      const max = resolvedData.maxAmountCents ?? item?.maxAmountCents
      if (min != null && max != null && min > max) addValidationError('El monto mínimo no puede superar al máximo.')
      const from = resolvedData.validFrom ?? item?.validFrom
      const until = resolvedData.validUntil ?? item?.validUntil
      if (from && until && new Date(from) > new Date(until)) addValidationError('La vigencia "desde" no puede ser posterior a "hasta".')
    },
    resolveInput: ({ resolvedData }: any) => {
      if (typeof resolvedData.termsMonths === 'string') resolvedData.termsMonths = parseTerms(resolvedData.termsMonths).join(', ')
      return resolvedData
    },
  },
  ui: {
    label: 'Planes de financiación',
    singular: 'Plan de financiación',
    plural: 'Planes de financiación',
    listView: { initialColumns: ['bank', 'name', 'tnaBps', 'cftBps', 'termsMonths', 'active', 'validUntil'] },
  },
  fields: {
    ...trackingFields,
    bank: relationship({ ref: 'Bank.plans', label: 'Banco', ui: { displayMode: 'select', labelField: 'name' } }),
    name: text({ label: 'Nombre del producto', validation: { isRequired: true, length: { max: 160 } }, ui: { description: 'Ej.: Préstamo prendario UVA, Prendario tasa fija' } }),
    active: checkbox({ label: 'Activo (visible en la web)', defaultValue: false }),
    tnaBps: bps('TNA (puntos básicos)', 'Tasa nominal anual. 85,5 % = 8550', true),
    teaBps: bps('TEA (puntos básicos)', 'Tasa efectiva anual. Opcional, se informa tal cual.'),
    cftBps: bps('CFT (puntos básicos)', 'Costo financiero total con IVA, informado por el banco.'),
    termsMonths: text({ label: 'Plazos disponibles (meses)', validation: { isRequired: true }, ui: { description: 'Separados por coma. Ej.: 12, 24, 36, 48' } }),
    minAmountCents: float({ label: 'Monto mínimo a financiar (centavos)', validation: { min: 0 } }),
    maxAmountCents: float({ label: 'Monto máximo a financiar (centavos)', validation: { min: 0 } }),
    maxFinancedBps: bps('Porcentaje financiable (puntos básicos)', 'Máximo del precio que se financia. 100 % = 10000; 80 % = 8000'),
    amortization: select({
      label: 'Sistema de amortización',
      type: 'string',
      defaultValue: 'frances',
      validation: { isRequired: true },
      options: [
        { label: 'Francés (cuota fija)', value: 'frances' },
        { label: 'Alemán (cuota decreciente)', value: 'aleman' },
      ],
    }),
    validFrom: timestamp({ label: 'Vigente desde' }),
    validUntil: timestamp({ label: 'Vigente hasta', ui: { description: 'Pasada esta fecha el plan deja de mostrarse en la web.' } }),
    extraCosts: text({ label: 'Gastos adicionales', ui: { displayMode: 'textarea', description: 'Ej.: Gastos de otorgamiento 3 % + IVA, seguro automotor obligatorio, inscripción de prenda.' } }),
    requirements: text({ label: 'Requisitos', ui: { displayMode: 'textarea' } }),
    sortOrder: integer({ label: 'Orden', defaultValue: 0 }),
  },
})
