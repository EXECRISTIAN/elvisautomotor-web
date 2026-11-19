// Simulador de cuotas de Elvis Automotores. Función pura: la usan el navegador (simulación en vivo)
// y el servidor (lo que queda registrado en la solicitud). Los resultados son ESTIMATIVOS.

export type AmortizationSystem = 'frances' | 'aleman'

export type PlanTerms = {
  tnaBps: number            // TNA en puntos básicos (85,5 % = 8550)
  termsMonths: number[]     // plazos disponibles
  minAmountCents: number | null
  maxAmountCents: number | null
  maxFinancedBps: number | null // porcentaje financiable del precio (80 % = 8000)
  amortization: AmortizationSystem
}

export type SimulationInput = { priceCents: number; downPaymentCents: number; termMonths: number }

export type SimulationResult =
  | { ok: true; financedCents: number; firstInstallmentCents: number; lastInstallmentCents: number; totalPaidCents: number; termMonths: number }
  | { ok: false; reason: string }

/** "12, 24,36" -> [12, 24, 36] (únicos, ordenados, entre 1 y 120). */
export function parseTerms(value: string | null | undefined): number[] {
  return [...new Set(String(value || '').split(/[^\d]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 120))].sort((a, b) => a - b)
}

export function formatBpsPercent(bps: number | null | undefined) {
  if (bps == null || !Number.isFinite(bps)) return '-'
  return `${(bps / 100).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %`
}

export function simulate(plan: PlanTerms, input: SimulationInput): SimulationResult {
  const price = Math.round(input.priceCents)
  const down = Math.round(input.downPaymentCents)
  const n = input.termMonths
  if (!Number.isFinite(price) || price <= 0) return { ok: false, reason: 'Indicá el precio del vehículo.' }
  if (!Number.isFinite(down) || down < 0) return { ok: false, reason: 'El anticipo no es válido.' }
  if (down >= price) return { ok: false, reason: 'El anticipo cubre el precio total: no hace falta financiar.' }
  if (!plan.termsMonths.includes(n)) return { ok: false, reason: 'Elegí un plazo disponible para este plan.' }
  const financed = price - down
  if (plan.maxFinancedBps != null && financed > Math.floor((price * plan.maxFinancedBps) / 10_000)) {
    const minDown = price - Math.floor((price * plan.maxFinancedBps) / 10_000)
    return { ok: false, reason: `Este plan financia hasta el ${formatBpsPercent(plan.maxFinancedBps)} del precio. Anticipo mínimo: ${(minDown / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}.` }
  }
  if (plan.minAmountCents != null && financed < plan.minAmountCents) return { ok: false, reason: 'El monto a financiar es menor al mínimo de este plan.' }
  if (plan.maxAmountCents != null && financed > plan.maxAmountCents) return { ok: false, reason: 'El monto a financiar supera el máximo de este plan.' }

  const i = plan.tnaBps / 10_000 / 12
  if (plan.amortization === 'aleman') {
    const principal = financed / n
    const first = principal + financed * i
    const last = principal + principal * i
    const total = financed + (financed * i * (n + 1)) / 2
    return { ok: true, financedCents: financed, firstInstallmentCents: Math.round(first), lastInstallmentCents: Math.round(last), totalPaidCents: Math.round(total), termMonths: n }
  }
  const installment = i === 0 ? financed / n : (financed * i) / (1 - Math.pow(1 + i, -n))
  return { ok: true, financedCents: financed, firstInstallmentCents: Math.round(installment), lastInstallmentCents: Math.round(installment), totalPaidCents: Math.round(installment * n), termMonths: n }
}

export const SIMULATION_DISCLAIMER =
  'Simulación estimativa y no vinculante. Las condiciones finales (tasa, cuota, CFT, seguros, IVA sobre intereses y gastos) las define la entidad y están sujetas a calificación y aprobación crediticia.'
