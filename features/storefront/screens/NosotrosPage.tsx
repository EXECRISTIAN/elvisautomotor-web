import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, BadgeCheck, CarFront, Clock, Landmark, MapPin } from 'lucide-react'
import { Container } from '../components/Container'
import { WhatsAppButton } from '../components/WhatsAppButton'
import { ELVIS_ABOUT, ELVIS_BANKS, ELVIS_INFO, ELVIS_LINKS, ELVIS_ZERO_KM_BRANDS } from '../lib/elvisContent'

export function NosotrosPage() {
  const years = new Date().getFullYear() - ELVIS_ABOUT.since
  return (
    <div>
      <section className="elv-band py-14 md:py-20">
        <Container>
          <p className="elv-eyebrow">Nosotros</p>
          <h1 className="sf-display mt-3 text-[clamp(1.9rem,4vw,3rem)]">
            Desde {ELVIS_ABOUT.since}, <span className="sf-gold-text">{years} años</span> en la compra y venta de autos
          </h1>
          <p className="mt-6 max-w-3xl text-[1.05rem] leading-relaxed" style={{ color: 'var(--sf-ink-2)' }} data-edit="nosotrosIntro">{ELVIS_ABOUT.intro}</p>
          <figure className="mt-10">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--sf-radius-md)] sm:aspect-[16/9]">
              <Image src="/images/elvis/salon-frente.jpg" alt="Frente del salón de Elvis Automotores en Andrés Baranda 2134, Quilmes" fill unoptimized sizes="(min-width: 1280px) 1200px, 100vw" className="object-cover object-[50%_70%]" />
            </div>
            <figcaption className="mt-3 text-[0.85rem]" style={{ color: 'var(--sf-ink-3)' }}>Nuestro salón en Andrés Baranda 2134, Quilmes.</figcaption>
          </figure>
        </Container>
      </section>

      <section className="py-14 md:py-20">
        <Container className="grid gap-6 lg:grid-cols-2">
          <article className="elv-panel">
            <Landmark className="size-10" strokeWidth={1.3} style={{ color: 'var(--sf-accent)' }} aria-hidden="true" />
            <h2 className="sf-display mt-5 text-[1.5rem]">Venta a crédito</h2>
            <p className="mt-4" style={{ color: 'var(--sf-ink-2)' }}>{ELVIS_ABOUT.credit}</p>
            <p className="mt-3" style={{ color: 'var(--sf-ink-2)' }}>{ELVIS_INFO.credit} {ELVIS_ABOUT.creditVisit}</p>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Bancos">{ELVIS_BANKS.map((bank) => <li key={bank} className="sf-chip">{bank}</li>)}</ul>
            <p className="mt-3 text-[0.8rem]" style={{ color: 'var(--sf-ink-3)' }}>{ELVIS_ABOUT.creditDisclaimer}</p>
            <Link href="/financing" className="sf-btn sf-btn-primary mt-6 rounded-[8px]">Consultar financiación <ArrowRight className="size-4" aria-hidden="true" /></Link>
          </article>
          <article className="elv-panel">
            <CarFront className="size-10" strokeWidth={1.3} style={{ color: 'var(--sf-accent)' }} aria-hidden="true" />
            <h2 className="sf-display mt-5 text-[1.5rem]">Véndelo en Elvis</h2>
            <p className="mt-4" style={{ color: 'var(--sf-ink-2)' }}>{ELVIS_ABOUT.buying}</p>
            <p className="mt-3" style={{ color: 'var(--sf-ink-2)' }}>{ELVIS_INFO.planCanje}</p>
            <Link href="/trade-in" className="sf-btn sf-btn-primary mt-6 rounded-[8px]">Cotizar mi auto <ArrowRight className="size-4" aria-hidden="true" /></Link>
          </article>
        </Container>
      </section>

      <section className="py-12" aria-labelledby="nos-brands">
        <Container>
          <h2 id="nos-brands" className="sf-display text-[1.4rem]">0 km de las marcas</h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {ELVIS_ZERO_KM_BRANDS.map((brand) => (
              <li key={brand} className="rounded-full border px-4 py-1.5 text-[0.85rem] font-semibold uppercase tracking-[0.06em]" style={{ borderColor: 'oklch(0.8 0.115 85 / 0.35)' }}>{brand}</li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="elv-band py-14">
        <Container className="grid gap-8 md:grid-cols-3">
          <div className="elv-benefit">
            <BadgeCheck className="size-8" strokeWidth={1.3} style={{ color: 'var(--sf-accent)' }} aria-hidden="true" />
            <h3 className="mt-3 font-bold uppercase tracking-[0.04em]">Seguridad, honestidad y eficiencia</h3>
            <p className="mt-2 text-[0.9rem]" style={{ color: 'var(--sf-ink-2)' }}>Usados y 0 km, con atención personalizada.</p>
          </div>
          <div className="elv-benefit">
            <Clock className="size-8" strokeWidth={1.3} style={{ color: 'var(--sf-accent)' }} aria-hidden="true" />
            <h3 className="mt-3 font-bold uppercase tracking-[0.04em]">Atención</h3>
            <p className="mt-2 text-[0.9rem]" style={{ color: 'var(--sf-ink-2)' }}>{ELVIS_ABOUT.attention}</p>
            <p className="mt-2 text-[0.9rem]" style={{ color: 'var(--sf-ink-2)' }}>{ELVIS_INFO.afternoon}</p>
            <p className="mt-1 text-[0.8rem]" style={{ color: 'var(--sf-ink-3)' }}>{ELVIS_ABOUT.hoursNote} {ELVIS_INFO.noTransfers}</p>
          </div>
          <div className="elv-benefit">
            <MapPin className="size-8" strokeWidth={1.3} style={{ color: 'var(--sf-accent)' }} aria-hidden="true" />
            <h3 className="mt-3 font-bold uppercase tracking-[0.04em]">Cómo llegar</h3>
            <a href={ELVIS_LINKS.maps} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[0.9rem] text-[var(--sf-accent)] underline-offset-4 hover:underline">Ver en Google Maps</a>
          </div>
        </Container>
      </section>

      <section className="py-14">
        <Container className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="sf-display text-[1.4rem]">Síguenos</h2>
          <div className="flex flex-wrap gap-2">
            {ELVIS_LINKS.social.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="sf-btn sf-btn-ghost rounded-[8px]">{link.label}</a>
            ))}
            <a href={ELVIS_LINKS.whatsappChannel} target="_blank" rel="noreferrer" className="sf-btn sf-btn-ghost rounded-[8px]">Canal de WhatsApp</a>
            <WhatsAppButton className="sf-btn sf-btn-primary rounded-[8px]" />
          </div>
        </Container>
      </section>
    </div>
  )
}
