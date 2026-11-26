import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, CarFront, Clock, Handshake, Headset, Landmark, Mail, MapPin, Phone, ShieldCheck, Zap } from 'lucide-react'
import { fetchGraphQL } from '@/features/storefront/lib/data/graphql-client'
import { GET_VEHICLES } from '@/features/storefront/lib/data/queries'
import { Vehicle } from '@/features/storefront/lib/types'
import { Container } from '../components/Container'
import { HomeFeaturedGrid, HomeUsedRail } from '../components/LiveSections'
import { WhatsAppButton } from '../components/WhatsAppButton'
import { WhatsAppChannelButton } from '../components/WhatsAppChannelButton'
import { loadHomeQuery, selectHomeFeaturedVehicles } from '../lib/data/home-inventory'
import { loadStorefrontBusiness } from '../lib/data/storefront-business'
import { createStorefrontBusiness } from '../lib/business'
import { loadProgressiveOffers } from '../lib/data/progressive-offers'
import { ProgressiveOfferCard } from '../components/ProgressiveOfferCard'
import { ELVIS_ABOUT, ELVIS_BANKS, ELVIS_INFO, ELVIS_ZERO_KM_BRANDS } from '../lib/elvisContent'
import { WeekdayHours } from '../components/WeekdayHours'

// Fotos reales de Elvis: frente del salón (Google Maps, subida por la agencia, sep. 2026) e interior (Instagram).
const HERO_PHOTO = '/images/elvis/salon-frente.jpg'
const SHOWROOM_PHOTO = '/images/elvis/salon-interior.jpg'

// Primero los vehículos marcados como "destacados" en el panel; se completa hasta 4 con las unidades disponibles más nuevas.
// Usados para su sección propia del inicio: los más nuevos primero.
async function getUsedVehicles() {
  return loadHomeQuery(
    () => fetchGraphQL<unknown>(GET_VEHICLES, {
      where: { AND: [{ status: { equals: 'available' } }, { condition: { equals: 'used' } }] },
      orderBy: [{ year: 'desc' }],
      take: 100,
    }),
    selectHomeFeaturedVehicles<Vehicle>,
  )
}

async function getFeaturedVehicles() {
  const query = (featuredOnly: boolean) => loadHomeQuery(
    () => fetchGraphQL<unknown>(GET_VEHICLES, {
      where: { AND: [{ status: { equals: 'available' } }, ...(featuredOnly ? [{ isFeatured: { equals: true } }] : [])] },
      orderBy: [{ year: 'desc' }],
      take: 4,
    }),
    selectHomeFeaturedVehicles<Vehicle>,
  )
  const [featured, latest] = await Promise.all([query(true), query(false)])
  if (featured.status !== 'ready') return latest
  if (latest.status !== 'ready') return featured
  const ids = new Set(featured.value.map(vehicle => vehicle.id))
  return { status: 'ready' as const, value: [...featured.value, ...latest.value.filter(vehicle => !ids.has(vehicle.id))].slice(0, 4) }
}

const HIGHLIGHTS = [
  { icon: ShieldCheck, title: 'Compra segura', text: 'Transparencia y confianza en cada operación.', href: '/inventory' },
  { icon: Handshake, title: 'Venta a crédito', text: 'Financiación de hasta el 100%, sujeta a aprobación.', href: '/financing' },
  { icon: CarFront, title: 'Véndelo en Elvis', text: 'Compramos tu usado de forma ágil y segura.', href: '/trade-in' },
  { icon: Headset, title: 'Asesoramiento', text: 'Te acompañamos en todo el proceso.', href: '/contact' },
]

const BENEFITS = [
  { icon: BadgeCheck, title: `Desde ${ELVIS_ABOUT.since}`, text: 'Compra y venta de usados y 0 km con seguridad, honestidad y eficiencia.' },
  { icon: Landmark, title: 'Hasta 100% financiado', text: 'Entrega inmediata: el vehículo lo pagas mientras lo usas. Sujeto a calificación y aprobación crediticia.' },
  { icon: CarFront, title: 'Compramos tu usado', text: 'Resolvemos todo para que cobres tu dinero de manera ágil, segura e inmediata.' },
  { icon: Headset, title: 'Consulta gratuita', text: 'Consulta tu crédito de forma presencial, personalizada, inmediata y sin costo en nuestro salón.' },
]

function SectionTitle({ eyebrow, title, id }: { eyebrow: string; title: string; id?: string }) {
  return (
    <div>
      <p className="elv-eyebrow">{eyebrow}</p>
      <h2 id={id} className="sf-display mt-2 text-[clamp(1.5rem,3vw,2.1rem)]">{title}</h2>
    </div>
  )
}

export async function HomePage() {
  const [featured, settings, offers, usedResult] = await Promise.all([getFeaturedVehicles(), loadStorefrontBusiness(), loadProgressiveOffers(), getUsedVehicles()])
  const usedAll = usedResult.status === 'ready' ? usedResult.value : []
  const used = usedAll.slice(0, 4)
  const liveOffers = offers.filter((offer) => offer.phase === 'live' || offer.phase === 'upcoming').slice(0, 2)
  const business = settings.status === 'ready' ? settings.business : createStorefrontBusiness()
  const adviceHref = 'https://formularioatenciononline.netlify.app/'
  const vehicles = featured.status === 'ready' ? featured.value.slice(0, 4) : []
  const words = business.shortName.trim().split(/\s+/)
  const lead = words[0] || 'Elvis'
  const rest = words.slice(1).join(' ')
  const tagline = business.homepageTitle && business.homepageTitle !== business.fullName && business.homepageTitle !== business.shortName
    ? business.homepageTitle
    : 'Tu próximo auto, más cerca.'
  const address = [business.addressLine1, business.addressLine2].filter(Boolean)
  const hours = [
    ['Lunes a viernes', business.hoursMonFri],
    ['Sábados', business.hoursSaturday],
    ['Domingos', business.hoursSunday],
  ].filter(([, value]) => value)

  return (
    <div className="sf-home elv-home" data-flush-end>
      {/* ---------- Hero ---------- */}
      <section className="elv-hero" aria-labelledby="hero-title">
        <picture>
          <source media="(max-width: 767px)" srcSet="/images/elvis/salon-frente-movil.jpg" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HERO_PHOTO} alt="" fetchPriority="high" decoding="async" className="absolute inset-0 size-full object-cover object-[60%_75%]" />
        </picture>
        <span className="elv-hero-shade" aria-hidden="true" />
        <span className="elv-hero-stripe" aria-hidden="true" />
        <Container className="relative flex min-h-[34rem] flex-col justify-center pb-28 pt-14 md:min-h-[38rem] md:pb-36">
          <p className="elv-kicker" data-edit="kicker">Calidad <span aria-hidden="true">•</span> Confianza <span aria-hidden="true">•</span> Respaldo</p>
          <h1 id="hero-title" className="mt-4">
            <span className="block text-[clamp(3rem,9vw,5.75rem)] font-semibold uppercase leading-none tracking-[0.12em]" style={{ color: 'var(--sf-bone)' }}>{lead}</span>
            {rest && <span className="sf-gold-text mt-2 block text-[clamp(1.6rem,5vw,3.25rem)] font-bold uppercase leading-none tracking-[0.12em]">{rest}</span>}
          </h1>
          <p className="elv-tagline mt-5" data-edit="heroTitulo">{tagline}</p>
          {business.homepageDescription && (
            <p className="mt-4 max-w-xl text-[0.95rem]" style={{ color: 'var(--sf-ink-2)' }} data-edit="heroTexto">{business.homepageDescription}</p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <div className="relative flex">
              <Link href="/inventory" className="sf-btn sf-btn-primary min-h-12 w-full rounded-[8px] px-6">
                Explora nuestro inventario
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              {/* En computadora va pegado debajo de "Explora", sin mover el resto. */}
              {adviceHref && (
                <a href={adviceHref} target="_blank" rel="noopener noreferrer" className="elv-advice-btn absolute inset-x-0 top-[calc(100%+0.5rem)] hidden lg:inline-flex">
                  <Zap className="size-4" aria-hidden="true" />Asesoramiento rápido
                </a>
              )}
            </div>
            <WhatsAppButton className="sf-btn sf-btn-outline min-h-12 rounded-[8px] px-6" />
            {/* En celular y tablet va al final, con el mismo formato que WhatsApp. */}
            {adviceHref && (
              <a href={adviceHref} target="_blank" rel="noopener noreferrer" className="sf-btn sf-btn-outline min-h-12 rounded-[8px] px-6 lg:hidden">
                <Zap className="size-5" aria-hidden="true" />Asesoramiento rápido
              </a>
            )}
          </div>
        </Container>
      </section>

      {/* ---------- Accesos rápidos ---------- */}
      <Container className="relative z-10 -mt-20 md:-mt-24">
        <nav aria-label="Accesos rápidos" className="elv-highlights">
          {HIGHLIGHTS.map(({ icon: Icon, title, text, href }) => (
            <Link key={title} href={href} className="elv-highlight group">
              <Icon className="size-9 shrink-0" strokeWidth={1.4} style={{ color: 'var(--sf-accent)' }} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[0.85rem] font-bold uppercase tracking-[0.04em] group-hover:text-[var(--sf-accent)]">{title}</span>
                <span className="mt-1 block text-[0.8rem] leading-snug" style={{ color: 'var(--sf-ink-2)' }}>{text}</span>
              </span>
            </Link>
          ))}
        </nav>
      </Container>

      {/* ---------- Vehículos destacados ---------- */}
      <section className="elv-cream -mt-16 pb-16 pt-28 md:-mt-20 md:pt-32" aria-labelledby="featured-title">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle eyebrow="Busca tu auto ideal" title="Encuentra el auto perfecto" id="featured-title" />
            <Link href="/inventory" className="sf-btn sf-btn-outline rounded-[8px]" style={{ color: 'var(--elv-cream-ink)' }}>
              Ver todo el inventario
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <HomeFeaturedGrid initial={vehicles} currencyCode={business.currencyCode} empty={
            <div className="elv-empty mt-8" role={featured.status === 'unavailable' ? 'alert' : undefined}>
              <p className="font-semibold">
                {featured.status === 'unavailable' ? 'No pudimos cargar el inventario en este momento.' : 'Estamos actualizando nuestro inventario.'}
              </p>
              <p className="mt-1 text-[0.9rem]" style={{ color: 'var(--elv-cream-ink-2)' }}>Escríbenos y te contamos qué unidades tenemos disponibles.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/contact" className="sf-btn sf-btn-primary rounded-[8px]">Contáctanos</Link>
                <WhatsAppButton className="sf-btn sf-btn-outline rounded-[8px]" />
              </div>
            </div>
          } />
          <div className="mt-10 flex justify-center">
            <WhatsAppChannelButton />
          </div>
        </Container>
      </section>

      {/* ---------- Usados seleccionados ---------- */}
      {used.length > 0 && (
        <section className="elv-band py-14 md:py-20" aria-labelledby="used-title">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="elv-eyebrow">Usados</p>
                <h2 id="used-title" className="sf-display mt-2 text-[clamp(1.6rem,3.2vw,2.4rem)]">Usados seleccionados, <span className="sf-gold-text">con informe</span></h2>
                <p className="mt-3" style={{ color: 'var(--sf-ink-2)' }}>Cada usado tiene su informe de estado: deuda, infracciones, GNC, aire, cubiertas, chapa, pintura y mecánica. Sin sorpresas.</p>
              </div>
            </div>
            <HomeUsedRail initial={used} total={usedAll.length} currencyCode={business.currencyCode} />
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
              <Link href="/financing" className="sf-btn sf-btn-outline min-h-12 whitespace-normal rounded-[8px] text-center">Financiación para usados</Link>
              <Link href="/trade-in" className="sf-btn sf-btn-ghost min-h-12 whitespace-normal rounded-[8px] text-center">Entrega tu usado como parte de pago</Link>
            </div>
          </Container>
        </section>
      )}

      {/* ---------- Ofertas progresivas ---------- */}
      {liveOffers.length > 0 && (
        <section className="py-16" aria-labelledby="offers-title">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionTitle eyebrow="Oferta progresiva" title="El precio baja hasta que alguien se lo lleva" id="offers-title" />
              <Link href="/ofertas" className="sf-btn sf-btn-outline rounded-[8px]">Ver ofertas <ArrowRight className="size-4" aria-hidden="true" /></Link>
            </div>
            <div className="mt-8 space-y-6">
              {liveOffers.map((offer) => <ProgressiveOfferCard key={offer.id} offer={offer} />)}
            </div>
          </Container>
        </section>
      )}

      {/* ---------- Marcas 0 km ---------- */}
      <section className="elv-band py-10" aria-labelledby="brands-title">
        <Container className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="elv-eyebrow">0 km</p>
            <h2 id="brands-title" className="sf-display mt-2 text-[clamp(1.2rem,2.2vw,1.6rem)]">Marcas que comercializamos</h2>
          </div>
          <ul className="flex flex-wrap gap-2 md:max-w-[60%] md:justify-end">
            {ELVIS_ZERO_KM_BRANDS.map((brand) => (
              <li key={brand} className="rounded-full border px-4 py-1.5 text-[0.85rem] font-semibold uppercase tracking-[0.06em]" style={{ borderColor: 'oklch(0.8 0.115 85 / 0.35)' }}>{brand}</li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ---------- Financiación + Tomamos tu usado ---------- */}
      <section className="py-16 md:py-20" aria-label="Financiación y toma de usados">
        <Container className="grid gap-6 lg:grid-cols-2">
          <article className="elv-panel" aria-labelledby="fin-title">
            <Landmark className="size-10" strokeWidth={1.3} style={{ color: 'var(--sf-accent)' }} aria-hidden="true" />
            <p className="elv-eyebrow mt-5">Venta a crédito</p>
            <h2 id="fin-title" className="sf-display mt-2 text-[clamp(1.4rem,2.6vw,1.9rem)]">Hasta 100% financiado</h2>
            <p className="mt-4 max-w-md" style={{ color: 'var(--sf-ink-2)' }}>
              {ELVIS_ABOUT.credit} Trabajamos con {ELVIS_BANKS.join(' y ')}. {ELVIS_ABOUT.creditVisit}
            </p>
            <p className="mt-3 text-[0.8rem]" style={{ color: 'var(--sf-ink-3)' }}>
              {ELVIS_ABOUT.creditDisclaimer} Las simulaciones son estimativas.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/financing" className="sf-btn sf-btn-primary rounded-[8px]">
                Consultar financiación
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <WhatsAppButton label="Consultar por WhatsApp" message={`Hola ${business.shortName}, quiero consultar por financiación.`} className="sf-btn sf-btn-ghost rounded-[8px]" />
            </div>
          </article>

          <article className="elv-panel elv-panel-photo" aria-labelledby="usado-title">
            <Image src={SHOWROOM_PHOTO} alt="" fill unoptimized sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover object-center" />
            <span className="elv-panel-photo-shade" aria-hidden="true" />
            <div className="relative">
              <CarFront className="size-10" strokeWidth={1.3} style={{ color: 'var(--sf-accent)' }} aria-hidden="true" />
              <p className="elv-eyebrow mt-5">Véndelo en Elvis</p>
              <h2 id="usado-title" className="sf-display mt-2 text-[clamp(1.4rem,2.6vw,1.9rem)]">Compramos tu usado</h2>
              <p className="mt-4 max-w-md" style={{ color: 'var(--sf-ink-2)' }}>
                {ELVIS_ABOUT.buying} {ELVIS_INFO.planCanje}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/trade-in" className="sf-btn sf-btn-primary rounded-[8px]">
                  Cotizar mi usado
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <WhatsAppButton label="Enviar por WhatsApp" message={`Hola ${business.shortName}, quiero cotizar mi usado.`} className="sf-btn sf-btn-ghost rounded-[8px]" />
              </div>
            </div>
          </article>
        </Container>
      </section>

      {/* ---------- Beneficios ---------- */}
      <section className="elv-band py-16" aria-labelledby="benefits-title">
        <Container>
          <SectionTitle eyebrow={`Por qué ${business.shortName}`} title="Comprar con respaldo" id="benefits-title" />
          <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="elv-benefit">
                <Icon className="size-9" strokeWidth={1.3} style={{ color: 'var(--sf-accent)' }} aria-hidden="true" />
                <h3 className="mt-4 text-[0.95rem] font-bold uppercase tracking-[0.04em]">{title}</h3>
                <p className="mt-2 text-[0.9rem] leading-relaxed" style={{ color: 'var(--sf-ink-2)' }}>{text}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ---------- Contacto ---------- */}
      <section className="py-16 md:py-20" aria-labelledby="contact-title">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div>
            <SectionTitle eyebrow="Contacto" title="Visítanos o escríbenos" id="contact-title" />
            <p className="mt-4 max-w-md" style={{ color: 'var(--sf-ink-2)' }}>
              {ELVIS_ABOUT.attention} {ELVIS_INFO.afternoon} {ELVIS_ABOUT.hoursNote} {ELVIS_INFO.contactPreference}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <WhatsAppButton className="sf-btn sf-btn-primary rounded-[8px]" />
              <Link href="/contact" className="sf-btn sf-btn-ghost rounded-[8px]">Formulario de contacto</Link>
            </div>
          </div>
          <dl className="elv-contact-grid">
            {address.length > 0 && (
              <div>
                <dt><MapPin className="size-5" aria-hidden="true" /> Dirección</dt>
                <dd>
                  {address.map((line) => <span key={line} className="block">{line}</span>)}
                  {business.directionsHref && (
                    <a href={business.directionsHref} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[var(--sf-accent)] underline-offset-4 hover:underline">Cómo llegar</a>
                  )}
                </dd>
              </div>
            )}
            {business.phoneDisplay && (
              <div>
                <dt><Phone className="size-5" aria-hidden="true" /> Teléfono</dt>
                <dd><a href={business.phoneHref} className="hover:text-[var(--sf-accent)]">{business.phoneDisplay}</a></dd>
              </div>
            )}
            {business.salesEmail && (
              <div>
                <dt><Mail className="size-5" aria-hidden="true" /> Email</dt>
                <dd><a href={`mailto:${business.salesEmail}`} className="break-all hover:text-[var(--sf-accent)]">{business.salesEmail}</a></dd>
              </div>
            )}
            {hours.length > 0 && (
              <div>
                <dt><Clock className="size-5" aria-hidden="true" /> Horarios</dt>
                <dd>{hours.map(([label, value]) => <span key={label} className="block">{label}: {label === 'Lunes a viernes' ? <WeekdayHours value={String(value)} /> : value}</span>)}</dd>
              </div>
            )}
            {address.length === 0 && !business.phoneDisplay && !business.salesEmail && hours.length === 0 && (
              <div>
                <dt><MapPin className="size-5" aria-hidden="true" /> Datos de contacto</dt>
                <dd>Usa el formulario de contacto y te respondemos a la brevedad.</dd>
              </div>
            )}
          </dl>
        </Container>
      </section>
    </div>
  )
}
