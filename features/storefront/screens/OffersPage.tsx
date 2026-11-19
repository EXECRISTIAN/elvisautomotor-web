import { Container } from '../components/Container'
import { ProgressiveOfferCard, type PublicProgressiveOffer } from '../components/ProgressiveOfferCard'
import { WhatsAppButton } from '../components/WhatsAppButton'
import { ELVIS_LINKS } from '../lib/elvisContent'

export function OffersPage({ offers }: { offers: PublicProgressiveOffer[] }) {
  const current = offers.filter((offer) => offer.phase === 'live' || offer.phase === 'upcoming')
  const past = offers.filter((offer) => offer.phase === 'sold' || offer.phase === 'final')
  return (
    <div>
      <section className="elv-band py-14">
        <Container>
          <p className="elv-eyebrow">Ofertas progresivas</p>
          <h1 className="sf-display mt-3 text-[clamp(1.9rem,4vw,3rem)]">Tú eliges cuánto pagarlo</h1>
          <p className="mt-5 max-w-3xl" style={{ color: 'var(--sf-ink-2)' }}>
            El precio baja cada hora o cada día que el auto no se vende (según la oferta), hasta llegar al precio final (¡a veces gratis!). Espera el momento que quieras para venir… salvo que otro se lo lleve antes. Hay una sola unidad: cuando se vende, termina la promo.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={ELVIS_LINKS.whatsappChannel} target="_blank" rel="noreferrer" className="sf-btn sf-btn-outline rounded-[8px]">Sigue las ofertas en el canal de WhatsApp</a>
            <WhatsAppButton className="sf-btn sf-btn-ghost rounded-[8px]" />
          </div>
        </Container>
      </section>

      <section className="py-14">
        <Container className="space-y-8">
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
