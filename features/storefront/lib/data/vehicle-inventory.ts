export type VehicleInventoryFilters = {
  search?: string
  make?: string
  model?: string
  yearMin?: string
  yearMax?: string
  priceMin?: string
  priceMax?: string
  mileageMin?: string
  mileageMax?: string
  condition?: string
  fuelType?: string
  transmission?: string
  progressiveOffer?: string
  carroceria?: string
  traccion?: string
  tipoTraccion?: string
}

export type VehicleInventorySortKey =
  | 'price-asc'
  | 'price-desc'
  | 'mileage-asc'
  | 'year-desc'
  | 'year-asc'
  | string

export const EMPTY_INVENTORY_FILTERS = {
  search: '', make: '', model: '', yearMin: '', yearMax: '', priceMin: '', priceMax: '', mileageMin: '', mileageMax: '', condition: '', fuelType: '', transmission: '', progressiveOffer: '', carroceria: '', traccion: '', tipoTraccion: '',
}

/** Read the inventory filters and sort from the URL. The server render and the client both use this. */
export function inventoryQueryFromSearch(search: string) {
  const params = new URLSearchParams(search)
  const year = params.get('year') || ''
  return {
    filters: {
      search: params.get('search') || '',
      make: params.get('make') || '',
      model: params.get('model') || '',
      yearMin: params.get('yearMin') || year,
      yearMax: params.get('yearMax') || year,
      priceMin: params.get('priceMin') || '',
      priceMax: params.get('priceMax') || '',
      mileageMin: params.get('mileageMin') || '',
      mileageMax: params.get('mileageMax') || '',
      condition: params.get('condition') || '',
      fuelType: params.get('fuelType') || '',
      carroceria: params.get('carroceria') || '',
      traccion: params.get('traccion') || '',
      tipoTraccion: params.get('tipoTraccion') || '',
      transmission: params.get('transmission') || '',
      progressiveOffer: params.get('progressiveOffer') || '',
    },
    sortBy: params.get('sort') || 'year-desc',
    page: params.get('page'),
  }
}

function parseNonNegativeInteger(value: string | undefined, label: string) {
  const normalized = value?.trim() || ''
  if (!normalized) return undefined
  if (!/^\d+$/.test(normalized)) throw new Error(`${label}: ingresa un número entero positivo.`)
  const number = Number(normalized)
  if (!Number.isSafeInteger(number)) throw new Error(`${label}: valor fuera de rango.`)
  return number
}

function parsePriceCents(value: string | undefined, label: string) {
  const normalized = value?.trim() || ''
  if (!normalized) return undefined
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) {
    throw new Error(`${label}: ingresa un importe válido.`)
  }
  const amount = Number(normalized)
  const cents = Math.round(amount * 100)
  if (!Number.isFinite(amount) || !Number.isSafeInteger(cents) || cents < 0) {
    throw new Error(`${label}: valor fuera de rango.`)
  }
  return cents
}

export function buildVehicleWhereInput(filters: VehicleInventoryFilters = {}) {
  const search = filters.search?.trim() || ''
  const make = filters.make?.trim() || ''
  const model = filters.model?.trim() || ''
  const yearMin = parseNonNegativeInteger(filters.yearMin, 'Año mínimo')
  const yearMax = parseNonNegativeInteger(filters.yearMax, 'Año máximo')
  const priceMinCents = parsePriceCents(filters.priceMin, 'Precio mínimo')
  const priceMaxCents = parsePriceCents(filters.priceMax, 'Precio máximo')
  const mileageMin = parseNonNegativeInteger(filters.mileageMin, 'Kilometraje mínimo')
  const mileageMax = parseNonNegativeInteger(filters.mileageMax, 'Kilometraje máximo')
  const condition = filters.condition?.trim() || ''

  if (yearMin !== undefined && yearMax !== undefined && yearMin > yearMax) {
    throw new Error('El año mínimo no puede ser mayor que el máximo.')
  }
  if (mileageMin !== undefined && mileageMax !== undefined && mileageMin > mileageMax) {
    throw new Error('El kilometraje mínimo no puede ser mayor que el máximo.')
  }
  if (priceMinCents !== undefined && priceMaxCents !== undefined && priceMinCents > priceMaxCents) {
    throw new Error('El precio mínimo no puede ser mayor que el máximo.')
  }

  const where: { AND: Record<string, unknown>[] } = {
    AND: [{ status: { equals: 'available' } }],
  }

  if (search) {
    where.AND.push({
      OR: [
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { trim: { contains: search, mode: 'insensitive' } },
      ],
    })
  }
  if (make) where.AND.push({ make: { contains: make, mode: 'insensitive' } })
  if (model) where.AND.push({ model: { contains: model, mode: 'insensitive' } })
  if (yearMin !== undefined) where.AND.push({ year: { gte: yearMin } })
  if (yearMax !== undefined) where.AND.push({ year: { lte: yearMax } })
  if (priceMinCents !== undefined) where.AND.push({ priceCents: { gte: priceMinCents } })
  if (priceMaxCents !== undefined) where.AND.push({ priceCents: { lte: priceMaxCents } })
  if (mileageMin !== undefined || mileageMax !== undefined) where.AND.push({ mileage: { ...(mileageMin !== undefined ? { gte: mileageMin } : {}), ...(mileageMax !== undefined ? { lte: mileageMax } : {}) } })
  if (condition) where.AND.push({ condition: { equals: condition } })
  const fuelType = filters.fuelType?.trim() || ''
  const transmission = filters.transmission?.trim() || ''
  if (fuelType) where.AND.push({ fuelType: { equals: fuelType } })
  if (transmission) where.AND.push({ transmission: { equals: transmission } })
  if (filters.progressiveOffer === 'true') where.AND.push({ progressiveOffer: { equals: true } })
  for (const key of ['carroceria', 'traccion', 'tipoTraccion'] as const) {
    const value = filters[key]?.trim()
    if (value) where.AND.push({ [key]: { equals: value } })
  }

  return where
}

export function buildVehicleOrderBy(sortBy: VehicleInventorySortKey = 'year-desc') {
  switch (sortBy) {
    case 'price-asc':
      return [{ priceCents: 'asc' }]
    case 'price-desc':
      return [{ priceCents: 'desc' }]
    case 'mileage-asc':
      return [{ mileage: 'asc' }]
    case 'year-asc':
      return [{ year: 'asc' }]
    case 'discount':
      return [{ discount: 'desc' }]
    case 'year-desc':
    default:
      return [{ year: 'desc' }]
  }
}
