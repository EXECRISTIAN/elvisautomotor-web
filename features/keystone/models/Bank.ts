import { list } from '@keystone-6/core'
import { checkbox, relationship, text } from '@keystone-6/core/fields'

import { permissions } from '../access'
import { trackingFields } from './trackingFields'

// Entidades con las que trabaja Elvis Automotores. Se administran desde el panel (Tablas → Bancos).
export const Bank = list({
  access: {
    operation: {
      query: permissions.canManageFinancing,
      create: permissions.canManageFinancing,
      update: permissions.canManageFinancing,
      delete: permissions.canManageFinancing,
    },
  },
  ui: { label: 'Bancos', singular: 'Banco', plural: 'Bancos', listView: { initialColumns: ['name', 'active', 'plans'] } },
  fields: {
    ...trackingFields,
    name: text({ label: 'Nombre del banco', validation: { isRequired: true, length: { max: 120 } } }),
    active: checkbox({ label: 'Activo', defaultValue: true }),
    website: text({ label: 'Sitio web', validation: { match: { regex: /^$|^https?:\/\//, explanation: 'Debe empezar con http:// o https://' } } }),
    notes: text({ label: 'Notas internas', ui: { displayMode: 'textarea' } }),
    // Integración futura: clave del proveedor (ver features/lib/financing/providers.ts). "manual" = sin API.
    providerKey: text({ label: 'Integración', defaultValue: 'manual', ui: { description: 'Deja "manual" hasta que exista una integración con la API del banco.' } }),
    plans: relationship({ ref: 'FinancingPlan.bank', many: true, label: 'Planes' }),
  },
})
