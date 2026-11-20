// Nombres en español de las tablas del panel y cuáles se muestran en el menú "Tablas" para Elvis.
// Solo cambia lo que se ve (label / singular); las claves y nombres GraphQL quedan intactos.
export const ELVIS_LIST_ES: Record<string, [string, string]> = {
  Vehicle: ['Vehículos', 'vehículo'],
  VehicleImage: ['Fotos de vehículos', 'foto de vehículo'],
  Make: ['Marcas', 'marca'],
  Model: ['Modelos', 'modelo'],
  ProgressiveOffer: ['Ofertas progresivas', 'oferta progresiva'],
  Bank: ['Bancos', 'banco'],
  FinancingPlan: ['Planes de financiación', 'plan de financiación'],
  FinancingApplication: ['Solicitudes de crédito', 'solicitud de crédito'],
  Lead: ['Consultas', 'consulta'],
  Customer: ['Clientes', 'cliente'],
  TestDrive: ['Pruebas de manejo', 'prueba de manejo'],
  TradeIn: ['Usados ofrecidos', 'usado ofrecido'],
  TradeInPhoto: ['Fotos de usados', 'foto de usado'],
  Deal: ['Operaciones', 'operación'],
  Task: ['Tareas', 'tarea'],
  User: ['Usuarios', 'usuario'],
  Role: ['Roles', 'rol'],
  DealershipProfile: ['Datos de la agencia', 'datos de la agencia'],
  PriceHistory: ['Historial de precios', 'historial de precio'],
  VehicleHistory: ['Historial de vehículos', 'historial de vehículo'],
  VehicleConditionReport: ['Informes de estado', 'informe de estado'],
  CustomerInteraction: ['Interacciones con clientes', 'interacción'],
  SalesVisit: ['Visitas al salón', 'visita'],
  LeadRoutingRule: ['Reglas de asignación', 'regla de asignación'],
  SavedReport: ['Reportes guardados', 'reporte guardado'],
  Rooftop: ['Sucursales', 'sucursal'],
}

/** Tablas que aparecen en el menú lateral y en el inicio de "Tablas". */
export const ELVIS_VISIBLE_LISTS = new Set([
  'Vehicle', 'VehicleImage', 'Make', 'Model', 'ProgressiveOffer', 'Bank', 'FinancingPlan', 'FinancingApplication',
  'Lead', 'Customer', 'TestDrive', 'TradeIn', 'TradeInPhoto', 'Deal', 'Task', 'User', 'Role',
])

export function elvisListLabels<T extends { key: string; label?: string; singular?: string }>(list: T): T {
  const es = ELVIS_LIST_ES[list.key]
  return es ? { ...list, label: es[0], singular: es[1] } : list
}

/** Tablas internas del sistema original que se ocultan del menú (siguen existiendo y accesibles por URL). */
const ALL_MODELS: string[] = ['AccountingBatch', 'AccountingMapping', 'AccountingProviderResponse', 'ApiKey', 'AuthenticationThrottle', 'Bank', 'Customer', 'CustomerContactPreferenceEvent', 'CustomerHousehold', 'CustomerInteraction', 'CustomerMergeEvent', 'Deal', 'DealApproval', 'DealerGroup', 'DealerGroupMembership', 'DealershipProfile', 'DeliveryCase', 'DomainAuditEvent', 'FinanceComplianceCheck', 'FinanceContractPackage', 'FinanceFundingCase', 'FinanceMenuVersion', 'FinanceProduct', 'FinanceProductCancellation', 'FinanceProductQuote', 'FinancingApplication', 'FinancingPlan', 'InventoryAcquisition', 'InventoryAcquisitionEvent', 'InventoryFeedError', 'InventoryFeedRun', 'InventoryMerchandisingVersion', 'InventoryReconWorkItem', 'InventoryStock', 'InventoryStockEvent', 'Lead', 'LeadAssignmentEvent', 'LeadRoutingRule', 'LenderDecision', 'LenderSubmission', 'Make', 'MembershipAuditEvent', 'Model', 'PartsInventory', 'PartsMovement', 'PartsPurchaseOrder', 'PaymentProvider', 'PaymentProviderEvent', 'PaymentRefund', 'PaymentTransaction', 'PriceHistory', 'ProgressiveOffer', 'RepairOrderLineItem', 'ReportRun', 'RetentionPolicy', 'Role', 'Rooftop', 'RooftopMembership', 'SalesVisit', 'SavedReport', 'ServiceAppointment', 'ServiceLaborOperation', 'ServiceOrder', 'ServicePackage', 'Task', 'TestDrive', 'TradeIn', 'TradeInPhoto', 'User', 'Vehicle', 'VehicleConditionReport', 'VehicleHistory', 'VehicleImage', 'WeOweItem']
export const ELVIS_HIDDEN_LISTS = new Set(ALL_MODELS.filter((key) => !ELVIS_VISIBLE_LISTS.has(key)))

export function isElvisVisibleList(list: { key?: string }) {
  return !list.key || !ELVIS_HIDDEN_LISTS.has(list.key)
}
