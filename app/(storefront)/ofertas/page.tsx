import type { Metadata } from 'next'
import { OffersPage } from '@/features/storefront/screens/OffersPage'
import { loadProgressiveOffers } from '@/features/storefront/lib/data/progressive-offers'
import { fetchGraphQL } from '@/features/storefront/lib/data/graphql-client'
import { GET_VEHICLES } from '@/features/storefront/lib/data/queries'
import { loadHomeQuery, selectHomeFeaturedVehicles } from '@/features/storefront/lib/data/home-inventory'
import type { Vehicle } from '@/features/storefront/lib/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Ofertas',
  description: 'Ofertas express (autos rebajados ahora) y ofertas progresivas (el precio baja hasta que alguien se lo lleva).',
}

async function loadExpressOffers() {
  const result = await loadHomeQuery(
    () => fetchGraphQL<unknown>(GET_VEHICLES, {
      where: { AND: [{ status: { equals: 'available' } }] },
      orderBy: [{ priceCents: 'asc' }],
      take: 100,
    }),
    selectHomeFeaturedVehicles<Vehicle>,
  )
  return result.status === 'ready' ? result.value : []
}

export default async function Page() {
  const [offers, vehicles] = await Promise.all([loadProgressiveOffers(), loadExpressOffers()])
  return <OffersPage offers={offers} vehicles={vehicles} />
}
