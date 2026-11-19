import type { Metadata } from 'next'
import { OffersPage } from '@/features/storefront/screens/OffersPage'
import { loadProgressiveOffers } from '@/features/storefront/lib/data/progressive-offers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Ofertas progresivas',
  description: 'El precio baja cada hora hasta que alguien se lo lleva. Tú eliges cuánto pagarlo.',
}

export default async function Page() {
  return <OffersPage offers={await loadProgressiveOffers()} />
}
