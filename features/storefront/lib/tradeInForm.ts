export const TRADE_IN_ESTIMATE_DISCLAIMER =
  'La tasación la realiza un asesor después de revisar el vehículo; no es una oferta automática.'

export type TradeInDraft = {
  year: string
  make: string
  model: string
  mileage: string
  vin: string
  condition: string
  ownership: string
  payoffAmount: string
}

const CONDITIONS = new Set(['excellent', 'good', 'fair', 'poor'])
const OWNERSHIP = new Set(['own', 'financing', 'lease'])

export type TradeInStepTransition = {
  step: 1 | 2 | 3
  error: string | null
}

export function validateTradeInStep(
  step: 1 | 2,
  draft: TradeInDraft,
  currentYear = new Date().getFullYear()
) {
  if (step === 1) {
    const year = Number(draft.year)
    if (!Number.isInteger(year) || year < 1980 || year > currentYear + 1) {
      return 'Elegí un año válido para continuar.'
    }
    if (!draft.make.trim()) return 'Indicá la marca para continuar.'
    if (!draft.model.trim()) return 'Indicá el modelo para continuar.'

    const mileage = Number(draft.mileage)
    if (!Number.isInteger(mileage) || mileage < 0 || mileage > 2_000_000) {
      return 'Ingresá un kilometraje válido para continuar.'
    }

    const vin = draft.vin.trim().toUpperCase()
    if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
      return 'Si cargás el número de chasis, debe tener 17 caracteres.'
    }
    return null
  }

  if (!CONDITIONS.has(draft.condition)) return 'Elegí el estado del vehículo para continuar.'
  if (!OWNERSHIP.has(draft.ownership)) return 'Elegí la titularidad para continuar.'
  if (draft.ownership === 'financing' && draft.payoffAmount.trim()) {
    const payoff = Number(draft.payoffAmount)
    if (!Number.isFinite(payoff) || payoff < 0 || payoff > 10_000_000_000) {
      return 'Ingresá un saldo de prenda válido para continuar.'
    }
  }
  return null
}

export function transitionTradeInStep(
  step: 1 | 2,
  draft: TradeInDraft,
  currentYear = new Date().getFullYear()
): TradeInStepTransition {
  const error = validateTradeInStep(step, draft, currentYear)
  return error
    ? { step, error }
    : { step: step + 1 as 2 | 3, error: null }
}
