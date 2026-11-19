import { list } from '@keystone-6/core'
import { image, integer, relationship } from '@keystone-6/core/fields'

import { permissions, rules } from '../access'
import { rooftopField, validateRooftopRecord } from '../tenantRecords'
import { trackingFields } from './trackingFields'

// Fotos que el cliente adjunta al ofrecer su usado ("Véndelo en Elvis").
// Solo se crean desde la mutación pública `attachTradeInPhoto` (con código temporal); el personal
// las ve con los mismos permisos que el usado al que pertenecen.
const readFilter = ({ session }: any) => {
  const filter = rules.canReadTradeIns({ session })
  if (typeof filter === 'boolean') return filter
  return { tradeIn: filter }
}

export const TradeInPhoto = list({
  access: {
    operation: {
      query: permissions.canAccessTradeIns,
      create: () => false,
      update: () => false,
      delete: permissions.canManageTradeIns,
    },
    filter: { query: readFilter, delete: readFilter },
  },
  hooks: {
    validate: (args: any) => (args.operation === 'delete' ? undefined : validateRooftopRecord(args, [{ field: 'tradeIn', listKey: 'TradeIn' }])),
  },
  ui: { hideCreate: true, label: 'Fotos de usados', listView: { initialColumns: ['tradeIn', 'image', 'sortOrder'] } },
  fields: {
    ...trackingFields,
    rooftop: rooftopField(),
    tradeIn: relationship({ ref: 'TradeIn.photos', label: 'Usado' }),
    image: image({ storage: 'my_images', label: 'Foto' }),
    sortOrder: integer({ defaultValue: 0, label: 'Orden' }),
  },
})
