import { formatCurrency } from './submissionUtils'

type FinancingLeadContentInput = {
  vehicleSummary: string
  requestedAmount: number | null
  monthlyPayment: number | null
  downPayment: number
  tradeInValue: number
  apr: number
  loanTerm: number
  plan?: { bankName: string; name: string; tnaBps: number; cftBps: number | null; amortization: string } | null
}

/**
 * CRM-safe financing copy. Income, employment, and self-reported credit data are
 * deliberately excluded because Lead.notes and Task.description are general CRM
 * fields, not a restricted credit-application store.
 */
export function buildFinancingLeadContent(input: FinancingLeadContentInput) {
  const pct = (bps: number | null | undefined) => (bps == null ? 'no informado' : `${(bps / 100).toLocaleString('es-AR')} %`)
  const requestedAmount = input.requestedAmount == null
    ? 'Monto a financiar: no informado.'
    : `Monto a financiar: ${formatCurrency(input.requestedAmount)}`
  const paymentEstimate = input.monthlyPayment == null
    ? 'Cuota estimada: no calculada.'
    : `Cuota estimada (simulación): ${formatCurrency(input.monthlyPayment)} en ${input.loanTerm || '?'} cuotas`
  const plan = input.plan
    ? `Plan elegido: ${input.plan.bankName} — ${input.plan.name} (TNA ${pct(input.plan.tnaBps)}, CFT ${pct(input.plan.cftBps)}, sistema ${input.plan.amortization === 'aleman' ? 'alemán' : 'francés'})`
    : 'Plan: sin elegir (consulta general de financiación).'
  const notes = [
    'Consulta de financiación enviada desde la web.',
    `Vehículo: ${input.vehicleSummary}`,
    plan,
    requestedAmount,
    paymentEstimate,
    `Anticipo: ${formatCurrency(input.downPayment)}`,
    `Valor del usado entregado: ${formatCurrency(input.tradeInValue)}`,
    'El cliente aceptó ser contactado. La simulación es estimativa; las condiciones finales dependen de la entidad y de la aprobación crediticia.',
  ].join('\n')

  const taskDescription = [
    `Revisar consulta de financiación. Vehículo: ${input.vehicleSummary}.`,
    input.plan ? `Plan: ${input.plan.bankName} — ${input.plan.name}.` : 'Sin plan elegido.',
    input.requestedAmount == null ? 'Monto no informado.' : `Monto: ${formatCurrency(input.requestedAmount)}.`,
  ].join(' ')

  return { notes, taskDescription }
}
