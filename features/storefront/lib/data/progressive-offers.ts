import { cache } from 'react'
import { openfrontClient } from '../config'
import type { PublicProgressiveOffer } from '../../components/ProgressiveOfferCard'

const QUERY = `
  query PublicProgressiveOffers {
    publicProgressiveOffers { id number title imageUrl vehicleId startsAt startPriceCents stepCents stepMinutes floorPriceCents status phase financing conditions includesTransfer walkIn }
  }
`

export const loadProgressiveOffers = cache(async (): Promise<PublicProgressiveOffer[]> => {
  try {
    const data = await openfrontClient.request<{ publicProgressiveOffers: PublicProgressiveOffer[] }>(QUERY)
    return data.publicProgressiveOffers ?? []
  } catch {
    return []
  }
})
