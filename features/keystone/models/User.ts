import { list } from '@keystone-6/core'
import { denyAll } from '@keystone-6/core/access'
import { checkbox, password, relationship, text, float, select } from '@keystone-6/core/fields'

import { isSignedIn, permissions, rules } from '../access'
import { trackingFields } from './trackingFields'

export const User = list({
  access: {
    operation: {
      query: isSignedIn,
      create: permissions.canManagePeople,
      update: isSignedIn,
      delete: permissions.canManagePeople,
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdatePeople,
    },
  },
  ui: {
    hideCreate: args => !permissions.canManagePeople(args),
    hideDelete: args => !permissions.canManagePeople(args),
    listView: {
      initialColumns: ['name', 'email', 'role', 'assignedLeads'],
    },
    itemView: {
      defaultFieldMode: ({ session, item }) => {
        // canEditOtherPeople can edit other people
        if (permissions.canEditOtherPeople({ session }) || permissions.canManagePeople({ session })) return 'edit'

        // edit themselves
        if (session?.itemId === item?.id) return 'edit'

        // else, default all fields to read mode
        return 'read'
      },
    },
  },
  fields: {
    ...trackingFields,
    // Basic Info
    name: text({
      label: 'Nombre y apellido',
      validation: {
        isRequired: true,
      },
    }),
    email: text({
      label: 'Usuario o email',
      isFilterable: false,
      isOrderable: false,
      isIndexed: 'unique',
      validation: {
        isRequired: true,
      },
    }),
    password: password({
      label: 'Contraseña',
      access: {
        read: denyAll,
        update: ({ session, item }) =>
          permissions.canManagePeople({ session }) || session?.itemId === item.id,
      },
      // Uso local: se admiten contraseñas cortas (el administrador de fábrica es 123 / 123).
      // Antes de publicar en internet, cambia esa contraseña por una segura.
      validation: { isRequired: true, length: { min: 3 } },
    }),
    role: relationship({
      label: 'Rol',
      ref: 'Role.assignedTo',
      access: {
        create: permissions.canManageRoles,
        update: ({ session, item }) =>
          permissions.canManageRoles({ session }) && session?.itemId !== item.id,
      },
      ui: {
        description: 'Necesario para que aparezca en Personal. Para un vendedor, elige "Vendedor".',
        createView: { fieldMode: args => permissions.canManageRoles(args) ? 'edit' : 'hidden' },
        itemView: {
          fieldMode: ({ session, item }) => permissions.canManageRoles({ session }) && rules.canUpdatePeople({ session }) === true && session?.itemId !== item?.id ? 'edit' : 'read',
        },
      },
    }),
    dealerGroupMemberships: relationship({
      ref: 'DealerGroupMembership.user',
      many: true,
      access: { update: denyAll },
      ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } },
    }),
    rooftopMemberships: relationship({
      ref: 'RooftopMembership.user',
      many: true,
      access: { update: denyAll },
      ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } },
    }),
    membershipAuditEvents: relationship({
      ref: 'MembershipAuditEvent.targetUser',
      many: true,
      access: { update: denyAll },
      ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } },
    }),
    performedMembershipAuditEvents: relationship({
      ref: 'MembershipAuditEvent.actor',
      many: true,
      access: { update: denyAll },
      ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } },
    }),
    domainAuditEvents: relationship({
      ref: 'DomainAuditEvent.actor',
      many: true,
      access: { update: denyAll },
      ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } },
    }),
    apiKeys: relationship({
      access: { create: () => false, update: () => false },
      ref: 'ApiKey.user',
      many: true,
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      },
    }),
    onboardingStatus: select({
      type: 'string',
      options: [
        { label: 'Not started', value: 'not_started' },
        { label: 'In progress', value: 'in_progress' },
        { label: 'Completed', value: 'completed' },
        { label: 'Dismissed', value: 'dismissed' },
      ],
      defaultValue: 'not_started',
      label: 'Estado de la configuración inicial',
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
        description: 'Tracks whether this user has completed dealership setup.',
      },
    }),

    // Dealership-specific fields
    phone: text({
      label: 'Teléfono',
      ui: {
        description: 'Teléfono de contacto (opcional)',
      },
    }),
    employeeId: text({
      access: { create: permissions.canManagePeople, update: permissions.canManagePeople, read: ({ session, item }) => permissions.canManagePeople({ session }) || session?.itemId === item.id },
      label: 'Legajo',
      ui: {
        createView: { fieldMode: 'hidden' },
        description: 'Número interno del empleado (opcional)',
        itemView: { fieldMode: ({ session, item }) => permissions.canManagePeople({ session }) ? 'edit' : session?.itemId === item?.id ? 'read' : 'hidden' },
      },
    }),
    commissionRate: float({
      access: { create: permissions.canManagePeople, update: permissions.canManagePeople, read: ({ session, item }) => permissions.canManagePeople({ session }) || session?.itemId === item.id },
      label: 'Comisión (%)',
      defaultValue: 0,
      validation: { min: 0, max: 100 },
      ui: {
        createView: { fieldMode: 'hidden' },
        description: 'Porcentaje de comisión por venta (por ejemplo, 10 para 10%)',
        itemView: { fieldMode: ({ session, item }) => permissions.canManagePeople({ session }) ? 'edit' : session?.itemId === item?.id ? 'read' : 'hidden' },
      },
    }),
    isSalesperson: checkbox({
      access: { create: permissions.canManagePeople, update: permissions.canManagePeople },
      defaultValue: false,
      label: 'Es vendedor',
      ui: {
        description: 'Marca si atiende consultas y operaciones de venta.',
        itemView: { fieldMode: args => permissions.canManagePeople(args) ? 'edit' : 'read' },
      },
    }),
    isServiceAdvisor: checkbox({
      access: { create: permissions.canManagePeople, update: permissions.canManagePeople },
      defaultValue: false,
      label: 'Es asesor de servicio',
      ui: {
        createView: { fieldMode: 'hidden' },
        description: 'Atiende el taller (no se usa en Elvis por ahora).',
        itemView: { fieldMode: args => permissions.canManagePeople(args) ? 'edit' : 'read' },
      },
    }),
    isFinanceManager: checkbox({
      access: { create: permissions.canManagePeople, update: permissions.canManagePeople },
      defaultValue: false,
      label: 'Gestiona créditos',
      ui: {
        description: 'Marca si gestiona solicitudes de crédito con los bancos.',
        itemView: { fieldMode: args => permissions.canManagePeople(args) ? 'edit' : 'read' },
      },
    }),

    // Reverse relationships are read-only. Their owning domain commands control linkage.
    assignedLeads: relationship({ ref: 'Lead.assignedSalesperson', many: true, access: { update: denyAll }, ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } }, label: 'Consultas asignadas' }),
    deals: relationship({ ref: 'Deal.salesperson', many: true, access: { update: denyAll }, ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } }, label: 'Operaciones' }),
    customerAppointments: relationship({ ref: 'ServiceAppointment.customer', many: true, access: { update: denyAll }, ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } }, label: 'Citas de taller (como cliente)' }),
    techAppointments: relationship({ ref: 'ServiceAppointment.assignedTech', many: true, access: { update: denyAll }, ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } }, label: 'Citas de taller (como técnico)' }),
    priceChanges: relationship({ ref: 'PriceHistory.changedBy', many: true, access: { update: denyAll }, ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } }, label: 'Cambios de precio' }),
    customerMergeEvents: relationship({ ref: 'CustomerMergeEvent.actor', many: true, access: { update: denyAll }, ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } } }),
    leadAssignmentsFrom: relationship({ ref: 'LeadAssignmentEvent.fromUser', many: true, access: { update: denyAll }, ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } } }),
    leadAssignmentsTo: relationship({ ref: 'LeadAssignmentEvent.toUser', many: true, access: { update: denyAll }, ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } } }),
    performedLeadAssignments: relationship({ ref: 'LeadAssignmentEvent.actor', many: true, access: { update: denyAll }, ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } } }),
    leadRoutingRules: relationship({ ref: 'LeadRoutingRule.assignee', many: true, access: { update: denyAll }, ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } } }),
    customerContactPreferenceEvents: relationship({ ref: 'CustomerContactPreferenceEvent.actor', many: true, access: { update: denyAll }, ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } } }),
    assignedSalesVisits: relationship({ ref: 'SalesVisit.assignedSalesperson', many: true, access: { update: denyAll }, ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } } }),
    managedSalesVisits: relationship({ ref: 'SalesVisit.manager', many: true, access: { update: denyAll }, ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } } }),
    interactions: relationship({ ref: 'CustomerInteraction.performedBy', many: true, access: { update: denyAll }, ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } }, label: 'Interacciones con clientes' }),
    tasks: relationship({ ref: 'Task.assignedTo', many: true, access: { update: denyAll }, ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } }, label: 'Tareas' }),
    dealApprovals: relationship({ ref: 'DealApproval.approver', many: true, access: { update: denyAll }, ui: { displayMode: 'count', createView: { fieldMode: 'hidden' } }, label: 'Aprobaciones' }),
  },
});
