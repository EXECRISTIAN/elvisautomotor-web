import type { Metadata } from 'next'

import { loadStorefrontBusiness } from '@/features/storefront/lib/data/storefront-business'
import { vehicleMetadata } from '@/features/storefront/lib/seo'
import { loadVehicleDetail } from '@/features/storefront/lib/data/vehicle-detail'
import { vehicleTitle } from '@/features/storefront/lib/format'
import { getBaseUrl } from '@/features/storefront/lib/getBaseUrl'
import { vehicleJsonLd, jsonLdString } from '@/features/storefront/lib/structuredData'
import { VehicleDetailPage } from '@/features/storefront/screens/VehicleDetailPage'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const result = await loadVehicleDetail(id)
  if (result.status === 'not-found') return { title: 'Vehículo no encontrado', robots: { index: false, follow: true } }
  if (result.status === 'unlisted') return { title: vehicleTitle(result.vehicle), robots: { index: false, follow: true } }
  if (result.status !== 'available') return { title: 'Vehículo' }
  const settings = await loadStorefrontBusiness()
  return settings.status === 'ready' ? vehicleMetadata(settings.business, result.vehicle) : { title: vehicleTitle(result.vehicle) }
}

export default async function Page({ params }: Props) {
  const { id } = await params
  const result = await loadVehicleDetail(id)
  const settings = result.status === 'available' ? await loadStorefrontBusiness() : null
  const jsonLd = result.status === 'available' && settings?.status === 'ready'
    ? vehicleJsonLd(settings.business, result.vehicle, (await getBaseUrl()) || null)
    : null
  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />}
      <VehicleDetailPage id={id} />
    </>
  )
}
