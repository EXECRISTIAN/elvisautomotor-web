import { Container } from '../components/Container'
import { VehicleCard } from '../components/VehicleCard'
import type { Vehicle } from '../lib/types'
import { ProgressiveOfferCard, type PublicProgressiveOffer } from '../components/ProgressiveOfferCard'
import { WhatsAppChannelButton } from '../components/WhatsAppChannelButton'

export function OffersPage({ offers, express = [] }: { offers: PublicProgressiveOffer[]; express?: Vehicle[] }) {
  const current = offers.filter((offer) => offer.phase === 'live' || offer.phase === 'upcoming')
  const past = offers.filter((offer) => offer.phase === 'sold' || offer.phase === 'final')
  return (
    <div>
      <section className="elv-band py-14">
        <Container>
          <p className="elv-eyebrow">Ofertas</p>
          <h1 className="sf-display mt-3 text-[clamp(1.9rem,4vw,3rem)]">Autos más baratos, hoy</h1>
          <p className="mt-5 max-w-3xl" style={{ color: 'var(--sf-ink-2)' }}>
            <strong>Ofertas express:</strong> autos con el precio rebajado en este momento.{' '}
            <strong>Ofertas progresivas:</strong> el precio baja cada hora o cada día hasta que alguien se lo lleva.
          </p>
          <nav aria-label="Secciones de ofertas" className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            <a href="#ofertas-express" className="sf-btn sf-btn-primary min-h-12 rounded-[8px]">Ofertas express</a>
            <a href="#ofertas-progresivas" className="sf-btn sf-btn-primary min-h-12 rounded-[8px]">Progresivas</a>
          </nav>
          <div className="mt-6 flex flex-wrap gap-3">
            <WhatsAppChannelButton />
          </div>
        </Container>
      </section>

      <section id="ofertas-express" className="scroll-mt-24 py-14" aria-labelledby="express-title">
        <Container>
          <h2 id="express-title" className="sf-display text-[clamp(1.4rem,3vw,2rem)]">Ofertas express</h2>
          <p className="sf-muted mt-2 max-w-2xl">Autos que en este momento están más baratos que su precio habitual.</p>
          {express.length > 0 ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {express.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}
            </div>
          ) : (
            <div className="sf-well mt-8 p-6" role="status">
              <p className="font-semibold">No hay ofertas express en curso en este momento.</p>
              <p className="sf-muted mt-1 text-[length:var(--sf-text-sm)]">Cuando bajemos el precio de un auto, aparece acá. También las avisamos en el canal de WhatsApp.</p>
            </div>
          )}
        </Container>
      </section>

      <section id="ofertas-progresivas" className="scroll-mt-24 border-t py-14" style={{ borderColor: 'var(--sf-rule)' }} aria-labelledby="progresivas-title">
        <Container className="space-y-8">
          <div>
            <h2 id="progresivas-title" className="sf-display text-[clamp(1.4rem,3vw,2rem)]">Ofertas progresivas</h2>
            <p className="sf-muted mt-2 max-w-3xl">El precio baja cada hora o cada día que el auto no se vende, hasta llegar al precio final (¡a veces gratis!). Espera el momento que quieras para venir… salvo que otro se lo lleve antes. Hay una sola unidad: cuando se vende, termina la promo.</p>
          </div>
          {current.length > 0 ? (
            current.map((offer) => <ProgressiveOfferCard key={offer.id} offer={offer} />)
          ) : (
            <div className="sf-well p-6">
              <p className="font-semibold">No hay una oferta progresiva en curso en este momento.</p>
              <p className="sf-muted mt-1 text-[length:var(--sf-text-sm)]">Las anunciamos en nuestro canal de WhatsApp: síguelo para enterarte de la próxima.</p>
            </div>
          )}
        </Container>
      </section>

      {past.length > 0 && (
        <section className="pb-16">
          <Container>
            <h2 className="sf-display text-[1.3rem]">Ofertas recientes</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {past.map((offer) => <ProgressiveOfferCard key={offer.id} offer={offer} compact />)}
            </div>
          </Container>
        </section>
      )}
    </div>
  )
}
