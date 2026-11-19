import { Suspense } from 'react'
import type { Metadata } from 'next'

import { loadStorefrontBusiness } from '@/features/storefront/lib/data/storefront-business'
import { pageMetadata } from '@/features/storefront/lib/seo'
import { PageFallback } from '@/features/storefront/components/PageFallback'
import { FinancingPage, type PublicFinancingPlan } from '@/features/storefront/screens/FinancingPage'
import { openfrontClient } from '@/features/storefront/lib/config'

export const dynamic = 'force-dynamic'

const PUBLIC_FINANCING_PLANS = `
  query PublicFinancingPlans {
    publicFinancingPlans { id bankName name tnaBps teaBps cftBps termsMonths minAmountCents maxAmountCents maxFinancedBps amortization validUntil extraCosts requirements }
  }
`

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadStorefrontBusiness()
  return settings.status === 'ready' ? pageMetadata(settings.business, 'financing', 'Financiación') : { title: 'Financiación' }
}

export default async function Page() {
  const plans = await openfrontClient
    .request<{ publicFinancingPlans: PublicFinancingPlan[] }>(PUBLIC_FINANCING_PLANS)
    .then((data) => data.publicFinancingPlans ?? [])
    .catch(() => [])
  return <Suspense fallback={<PageFallback />}><FinancingPage plans={plans} /></Suspense>
}
