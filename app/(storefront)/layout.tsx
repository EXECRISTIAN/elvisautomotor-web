import type { Metadata } from 'next'

import { StorefrontShell } from '@/features/storefront'
import { loadStorefrontBusiness } from '@/features/storefront/lib/data/storefront-business'
import { getBaseUrl } from '@/features/storefront/lib/getBaseUrl'
import { storefrontMetadata } from '@/features/storefront/lib/seo'
import { dealerJsonLd, jsonLdString } from '@/features/storefront/lib/structuredData'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadStorefrontBusiness()

  if (settings.status === 'error') {
    return { title: 'No pudimos cargar esta página', robots: { index: false, follow: false } }
  }

  return storefrontMetadata(settings.business, (await getBaseUrl()) || null)
}

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const settings = await loadStorefrontBusiness()
  const jsonLd = settings.status === 'ready' ? dealerJsonLd(settings.business, (await getBaseUrl()) || null) : null
  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />}
      <StorefrontShell settings={settings}>{children}</StorefrontShell>
    </>
  )
}
