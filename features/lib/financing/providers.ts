// Arquitectura para integrar APIs bancarias en el futuro.
// Hoy todos los bancos usan el proveedor "manual": la solicitud queda en el panel y el personal la
// gestiona con la entidad. Para integrar un banco, se implementa un BankProvider con su clave y se
// carga esa clave en el campo "Integración" del banco.

export type FinancingRequestSnapshot = {
  reference: string
  bankName: string
  planName: string
  financedCents: number
  termMonths: number
  applicant: { fullName: string; email: string; phone: string }
}

export type BankProvider = {
  key: string
  label: string
  /** Envía la solicitud a la entidad. Debe devolver la referencia del banco o lanzar un error. */
  submitApplication?: (request: FinancingRequestSnapshot) => Promise<{ externalReference: string }>
  /** Cotización en línea, si la entidad la ofrece. */
  quote?: (input: { financedCents: number; termMonths: number }) => Promise<{ installmentCents: number; tnaBps: number; cftBps?: number }>
}

const manualProvider: BankProvider = { key: 'manual', label: 'Gestión manual (sin API)' }

const providers = new Map<string, BankProvider>([[manualProvider.key, manualProvider]])

export function registerBankProvider(provider: BankProvider) {
  providers.set(provider.key, provider)
}

export function bankProvider(key: string | null | undefined): BankProvider {
  return providers.get(String(key || 'manual')) ?? manualProvider
}
