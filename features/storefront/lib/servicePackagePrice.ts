import { storefrontCurrency } from './format'

const MAX_SERVICE_PACKAGE_PRICE_CENTS = Number.MAX_SAFE_INTEGER

export function formatServicePackagePrice(value: unknown, currencyCode?: string | null): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null

  const rawCents = value * 100
  const cents = Math.round(rawCents)
  if (!Number.isSafeInteger(cents) || cents > MAX_SERVICE_PACKAGE_PRICE_CENTS || Math.abs(rawCents - cents) > 0.000001) {
    return null
  }

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: storefrontCurrency(currencyCode),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}
