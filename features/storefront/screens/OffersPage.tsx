import { Container } from '../components/Container'
import type { Vehicle } from '../lib/types'
import { type PublicProgressiveOffer } from '../components/ProgressiveOfferCard'
import { LocalOffersExtras } from '../components/LocalOffersExtras'
import { OffersExplorer } from '../components/OffersExplorer'

export function OffersPage({ offers, vehicles = [] }: { offers: PublicProgressiveOffer[]; vehicles?: Vehicle[] }) {
  return (
    <div>
      <section className="elv-band py-12">
        <Container>
          <p className="elv-eyebrow">Ofertas</p>
          <h1 className="sf-display mt-3 text-[clamp(1.9rem,4vw,3rem)]">Autos más baratos, hoy</h1>
          <p className="mt-5 max-w-3xl" style={{ color: 'var(--sf-ink-2)' }}>
            <strong data-edit="ofertaExpressNombre">Ofertas express</strong>: autos con el precio rebajado en este momento.{' '}
            <strong data-edit="ofertaProgresivaNombre">Ofertas progresivas</strong>: el precio baja cada hora o cada día hasta que alguien se lo lleva.
          </p>
        </Container>
      </section>
      <OffersExplorer vehicles={vehicles} offers={offers} />
      <LocalOffersExtras />
    </div>
  )
}
