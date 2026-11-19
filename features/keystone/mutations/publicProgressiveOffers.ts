import { offerState } from '../../lib/progressiveOffer'

/** Ofertas progresivas para la web: programadas, en curso y las terminadas en los últimos 7 días. */
export async function loadPublicProgressiveOffers(context: any, now = new Date()) {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const offers = await context.sudo().query.ProgressiveOffer.findMany({
    where: { status: { not: { equals: 'cancelled' } } },
    orderBy: [{ startsAt: 'desc' }],
    take: 30,
    query: 'id number title photoUrl photo { url } startsAt startPriceCents stepCents stepMinutes floorPriceCents status soldAt financing conditions includesTransfer noAppointment vehicle { id status }',
  })
  return offers
    .map((offer: any) => {
      const state = offerState(offer, now)
      return {
        id: offer.id,
        number: offer.number ?? null,
        title: offer.title,
        imageUrl: offer.photo?.url || offer.photoUrl || null,
        vehicleId: offer.vehicle?.id || null,
        startsAt: new Date(offer.startsAt),
        startPriceCents: offer.startPriceCents,
        stepCents: offer.stepCents,
        stepMinutes: offer.stepMinutes,
        floorPriceCents: offer.floorPriceCents,
        status: offer.status,
        phase: state.phase,
        financing: offer.financing || '',
        conditions: offer.conditions || '',
        includesTransfer: offer.includesTransfer !== 'excluded',
        walkIn: offer.noAppointment !== 'appointment',
        _endedAt: offer.soldAt ? new Date(offer.soldAt) : null,
      }
    })
    .filter((offer: any) => offer.phase !== 'sold' || (offer._endedAt && offer._endedAt >= since) || new Date(offer.startsAt) >= since)
    .filter((offer: any) => offer.phase !== 'final' || new Date(offer.startsAt) >= since)
    .map(({ _endedAt, ...offer }: any) => offer)
}

export async function publicProgressiveOffers(_root: unknown, _args: unknown, context: any) {
  return loadPublicProgressiveOffers(context)
}

/** IDs de vehículos con una oferta progresiva programada o en curso (para el filtro del inventario). */
export async function activeProgressiveOfferVehicleIds(context: any, now = new Date()) {
  const offers = await loadPublicProgressiveOffers(context, now)
  return new Set<string>(offers.filter((o: any) => (o.phase === 'upcoming' || o.phase === 'live') && o.vehicleId).map((o: any) => o.vehicleId))
}
