'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Container } from './Container'
import { SocialIcon } from './SocialIcon'
import { WeekdayHours } from './WeekdayHours'
import { WhatsAppButton } from './WhatsAppButton'
import { WhatsAppChannelButton } from './WhatsAppChannelButton'
import { ELVIS_ABOUT, ELVIS_INFO, ELVIS_LINKS } from '../lib/elvisContent'
import { BrandMark } from './BrandMark'
import { useStorefrontBusiness } from './StorefrontBusinessProvider'

const SHOP = [
  { href: '/inventory', label: 'Inventario' },
  { href: '/ofertas', label: 'Ofertas' },
  { href: '/precalificador', label: 'Precalifica tu crédito' },
  { href: '/compare', label: 'Comparar' },
  { href: '/financing', label: 'Financiación' },
  { href: '/trade-in', label: 'Vende tu auto' },
]

const VISIT = [
  { href: '/nosotros', label: 'Nosotros' },
  { href: '/test-drive', label: 'Prueba de manejo' },
  { href: '/contact', label: 'Contacto' },
  { href: '/account', label: 'Mi cuenta' },
]

export function Footer(_props: { branding?: boolean } = {}) {
  const year = new Date().getFullYear()
  const business = useStorefrontBusiness()
  const hours = [
    { label: 'Lun–Vie', value: business.hoursMonFri ? <WeekdayHours value={business.hoursMonFri} /> : '' },
    { label: 'Sáb', value: business.hoursSaturday },
    { label: 'Dom', value: business.hoursSunday },
  ].filter((row) => row.value)
  const hasAddress = business.addressLine1 || business.addressLine2

  return (
    <footer className="sf-band border-t" style={{ borderColor: 'var(--sf-rule-dark)' }}>
      <Container className="py-[var(--sf-space-xl)] md:py-[var(--sf-space-2xl)]">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
          <div className="col-span-2 min-w-0 md:col-span-1">
            <BrandMark size="lg" />
            {hasAddress && (
              <address className="mt-5 text-[length:var(--sf-text-sm)] not-italic" style={{ color: 'var(--sf-on-dark-2)' }}>
                {business.addressLine1 && <div>{business.addressLine1}</div>}
                {business.addressLine2 && <div>{business.addressLine2}</div>}
              </address>
            )}
            {(business.phoneDisplay || business.directionsHref) && (
              <div className="mt-5 flex flex-wrap gap-2">
                {business.phoneHref && business.phoneDisplay && (
                  <a href={business.phoneHref} className="sf-btn sf-btn-primary sf-btn-sm min-h-11">
                    <span className="sf-figure">{business.phoneDisplay}</span>
                  </a>
                )}
                {business.directionsHref && (
                  <a href={business.directionsHref} target="_blank" rel="noreferrer" className="sf-btn sf-btn-ghost sf-btn-sm min-h-11">
                    Cómo llegar
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
            <WhatsAppButton className="sf-btn sf-btn-outline sf-btn-sm mt-3 min-h-11" />
            <WhatsAppChannelButton compact className="mt-3" />
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--sf-text-xs)]" aria-label="Redes sociales">
              {ELVIS_LINKS.social.map((link) => (
                <li key={link.href}><a href={link.href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 min-w-11 items-center gap-1.5 hover:text-[var(--sf-accent)]"><SocialIcon label={link.label} className="size-3.5 shrink-0" />{link.label}</a></li>
              ))}
            </ul>
          </div>

          <nav aria-label="Comprar" className="min-w-0">
            <p className="sf-eyebrow mb-4">Comprar</p>
            <ul className="text-[length:var(--sf-text-sm)] md:space-y-2.5">
              {SHOP.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="inline-flex min-h-11 items-center transition-opacity hover:opacity-70 md:min-h-0">{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Visítanos" className="min-w-0">
            <p className="sf-eyebrow mb-4">Visítanos</p>
            <ul className="text-[length:var(--sf-text-sm)] md:space-y-2.5">
              {VISIT.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="inline-flex min-h-11 items-center transition-opacity hover:opacity-70 md:min-h-0">{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="col-span-2 min-w-0 md:col-span-1">
            <p className="sf-eyebrow mb-4">Horarios</p>
            {hours.length > 0 ? (
              <dl className="space-y-2 text-[length:var(--sf-text-sm)]">
                {hours.map((row) => (
                  <div key={row.label} className="flex gap-4">
                    <dt className="sf-figure w-16 shrink-0" style={{ color: 'var(--sf-on-dark-2)' }}>{row.label}</dt>
                    <dd className="min-w-0 tabular-nums">{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-[length:var(--sf-text-sm)]" style={{ color: 'var(--sf-on-dark-2)' }}>Consulta nuestros horarios</p>
            )}
            <p className="mt-3 text-[length:var(--sf-text-xs)]" style={{ color: 'var(--sf-on-dark-2)' }}>{ELVIS_ABOUT.hoursNote} {ELVIS_INFO.noTransfers}</p>
            {business.salesEmail && (
              <a href={`mailto:${business.salesEmail}`} className="mt-4 flex min-h-11 items-center break-all text-[length:var(--sf-text-sm)] underline-offset-4 hover:underline">
                {business.salesEmail}
              </a>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t pt-6 text-[length:var(--sf-text-xs)] sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--sf-rule-dark)', color: 'var(--sf-on-dark-2)' }}>
          <p>© {year} {business.fullName.replace(/\.$/, '')}. Todos los derechos reservados.</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/terminos" className="inline-flex min-h-11 items-center transition-opacity hover:opacity-70">Términos y condiciones de uso</Link>
            <Link href="/panel" className="inline-flex min-h-11 items-center transition-opacity hover:opacity-70">Acceso al panel</Link>
          </div>
        </div>
      </Container>
    </footer>
  )
}
