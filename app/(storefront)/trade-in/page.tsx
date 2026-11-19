import { Suspense } from 'react'
import type { Metadata } from 'next'

import { PageFallback } from '@/features/storefront/components/PageFallback'
import { TradeInPage } from '@/features/storefront/screens/TradeInPage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Vendelo en Elvis' }

export default function Page() {
  return <Suspense fallback={<PageFallback />}><TradeInPage /></Suspense>
}
