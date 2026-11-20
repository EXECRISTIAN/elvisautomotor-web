'use client'

// Lecturas públicas desde el navegador. En la muestra local (sin servidor) responde con la copia del
// inventario incluida en el zip (_offline/datos.json), con los mismos filtros y orden que el servidor.
import { fetchGraphQL as serverFetch } from './graphql-client'
import { isLocalDemo } from '../localStore'

type Vehicle = Record<string, any>
let snapshot: Promise<{ vehicles: Vehicle[] }> | null = null
const load = (): Promise<{ vehicles: Vehicle[] }> => (snapshot ??= fetch('/_offline/datos.json').then((r) => r.json() as Promise<{ vehicles: Vehicle[] }>).catch(() => ({ vehicles: [] as Vehicle[] })))

const lower = (v: unknown) => String(v ?? '').toLocaleLowerCase()
function inRange(value: unknown, range?: { gte?: number; lte?: number }) {
  if (!range) return true
  const n = Number(value)
  if (!Number.isFinite(n)) return false
  return (range.gte == null || n >= range.gte) && (range.lte == null || n <= range.lte)
}
function matches(v: Vehicle, where: any): boolean {
  if (!where || typeof where !== 'object') return true
  if (Array.isArray(where.AND)) return where.AND.every((w: any) => matches(v, w))
  if (Array.isArray(where.OR)) return where.OR.some((w: any) => matches(v, w))
  return Object.entries(where).every(([key, cond]: [string, any]) => {
    if (key === 'status') return cond?.equals ? lower(v.status) === lower(cond.equals) || (cond.equals === 'available' && v.status === 'available') : true
    if (key === 'condition' || key === 'fuelType' || key === 'transmission') return cond?.equals ? lower(v[key]) === lower(cond.equals) : true
    if (key === 'make' || key === 'model' || key === 'trim') return cond?.contains ? lower(v[key]).includes(lower(cond.contains)) : cond?.equals ? lower(v[key]) === lower(cond.equals) : true
    if (key === 'isFeatured' || key === 'progressiveOffer') return cond?.equals === true ? Boolean(v[key]) : true
    if (key === 'expressOffer') return cond?.equals === true ? Boolean(v.previousPrice && v.previousPrice > v.price) : true
    if (key === 'year' || key === 'mileage') return inRange(v[key], cond)
    if (key === 'priceCents') return inRange(v.price == null ? null : Math.round(v.price * 100), cond)
    if (key === 'id') return cond?.in ? cond.in.includes(v.id) : cond?.equals ? v.id === cond.equals : true
    return true
  })
}
function order(list: Vehicle[], orderBy: any) {
  const first = Array.isArray(orderBy) ? orderBy[0] : orderBy
  const [field, dir] = first ? Object.entries(first)[0] as [string, string] : ['year', 'desc']
  const key = field === 'priceCents' ? 'price' : field
  const sign = dir === 'asc' ? 1 : -1
  return [...list].sort((a, b) => ((Number(a[key]) || 0) - (Number(b[key]) || 0)) * sign || String(a.id).localeCompare(String(b.id)))
}

export async function fetchGraphQL<T>(query: string, variables?: Record<string, any>): Promise<T> {
  if (!isLocalDemo()) return serverFetch<T>(query, variables)
  const { vehicles } = await load()
  if (/publicInventoryVehicle\s*\(\s*id/.test(query)) {
    const found = vehicles.find((v) => v.id === variables?.id) ?? null
    return { publicInventoryVehicle: found } as T
  }
  if (/publicInventoryVehicles/.test(query)) {
    const filtered = order(vehicles.filter((v) => matches(v, variables?.where)), variables?.orderBy)
    const skip = Number(variables?.skip) || 0
    const take = Number(variables?.take) || 50
    return { publicInventoryVehicles: { totalCount: filtered.length, items: filtered.slice(skip, skip + take) } } as T
  }
  return {} as T
}
