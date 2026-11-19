import { MAX_CENTS, MAX_TAX_RATE_BPS } from '@/features/keystone/lifecycle/dealPricing'

const amountPattern = /^\d+(\.\d{0,2})?$|^\.\d{1,2}$/

/**
 * Normaliza un importe escrito en formato argentino o internacional a "1234.56":
 * "54.900.000", "54.900.000,50", "54900000", "$ 54.900.000", "33,450.50" (formato EE.UU.).
 */
export function normalizeMoneyText(text: string): string {
  const cleaned = text.trim().replace(/^\$\s*/, '').replace(/\s/g, '')
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned) || /^\d+,\d{1,2}$/.test(cleaned)) {
    return cleaned.replace(/\./g, '').replace(',', '.')
  }
  return cleaned.replace(/,/g, '')
}

/** "$ 54.900.000" -> 5490000000. Vacío es cero; cualquier otra cosa que no sea un importe devuelve null. */
export function parseDollarsToCents(text: string): number | null {
  const cleaned = normalizeMoneyText(text)
  if (!cleaned) return 0
  if (!amountPattern.test(cleaned)) return null
  const [whole, fraction = ''] = cleaned.split('.')
  const cents = Number(whole || 0) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null
}

/** 5490000000 -> "54.900.000"; con centavos: "54.900.000,50". */
export function formatCentsForInput(cents: number | null | undefined): string {
  const value = Number(cents) || 0
  return (value / 100).toLocaleString('es-AR', { minimumFractionDigits: value % 100 ? 2 : 0, maximumFractionDigits: 2 })
}

/** "4.15" or "4.15%" -> 415 basis points; null when it is not 0-100 with two decimals. */
export function parsePercentToBps(text: string): number | null {
  const cleaned = text.trim().replace(/%$/, '').trim()
  if (!cleaned) return 0
  if (!amountPattern.test(cleaned)) return null
  const [whole, fraction = ''] = cleaned.split('.')
  const bps = Number(whole || 0) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(bps) && bps <= MAX_TAX_RATE_BPS ? bps : null
}

export function formatBpsForInput(bps: number | null | undefined): string {
  const value = Number(bps) || 0
  return (value / 100).toFixed(2).replace(/\.?0+$/, '')
}
