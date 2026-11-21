'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowUpRight, Menu, Phone, Search, SquareStack, UserRound, X } from 'lucide-react'
import { getComparisonVehicles } from '@/features/storefront/lib/comparison'
import { isEscapeKey, restoreFocusAfterClose } from '../lib/dialogAccessibility'
import { BrandMark } from './BrandMark'
import { Container } from './Container'
import { WhatsAppButton } from './WhatsAppButton'
import { useStorefrontBusiness } from './StorefrontBusinessProvider'

const NAV = [
  { href: '/', label: 'Inicio' },
  { href: '/inventory', label: 'Inventario' },
  { href: '/ofertas', label: 'Ofertas' },
  { href: '/financing', label: 'Financiación' },
  { href: '/trade-in', label: 'Vende tu auto' },
  { href: '/nosotros', label: 'Nosotros' },
  { href: '/contact', label: 'Contacto' },
  { href: '/account', label: 'Clientes' },
]

const MENU = [
  { href: '/', label: 'Inicio' },
  { href: '/inventory', label: 'Inventario' },
  { href: '/inventory?condition=new', label: 'Autos 0 km' },
  { href: '/inventory?condition=used', label: 'Autos usados' },
  { href: '/ofertas', label: 'Ofertas' },
  { href: '/financing', label: 'Financiación' },
  { href: '/precalificador', label: 'Precalifica tu crédito' },
  { href: '/trade-in', label: 'Vende tu auto' },
  { href: '/test-drive', label: 'Prueba de manejo' },
  { href: '/compare', label: 'Comparar' },
  { href: '/nosotros', label: 'Nosotros' },
  { href: '/contact', label: 'Contacto' },
  { href: '/account', label: 'Mi cuenta' },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function Header() {
  const router = useRouter()
  const pathname = usePathname() || '/'
  const business = useStorefrontBusiness()
  const [savedCount, setSavedCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const sync = () => setSavedCount(getComparisonVehicles().length)
    sync()
    window.addEventListener('comparison-updated', sync)
    return () => window.removeEventListener('comparison-updated', sync)
  }, [])

  // Close the menu when the route changes (state-during-render, not an effect).
  const [menuPath, setMenuPath] = useState(pathname)
  if (menuPath !== pathname) {
    setMenuPath(pathname)
    setMenuOpen(false)
  }

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    router.push(`/inventory?search=${encodeURIComponent(q)}`)
    setQuery('')
    setMenuOpen(false)
  }

  const closeMenuFromKeyboard = () => {
    setMenuOpen(false)
    restoreFocusAfterClose(menuButtonRef.current)
  }

  const handleHeaderKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!menuOpen || !isEscapeKey(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    closeMenuFromKeyboard()
  }

  const hasPhone = Boolean(business.phoneHref && business.phoneDisplay)

  return (
    <header className="sticky top-0 z-50" onKeyDown={handleHeaderKeyDown}>
      <div className="sf-band border-b" style={{ borderColor: 'var(--sf-rule-dark)' }}>
        <Container className="flex h-[4.5rem] items-center gap-3 md:h-24">
          <BrandMark className="flex-1 lg:flex-none lg:shrink-0" />

          <nav className="mx-auto hidden min-w-0 items-center gap-0 lg:flex xl:gap-2" aria-label="Principal">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="sf-caps sf-nav-link relative whitespace-nowrap px-2.5 py-2 text-[0.72rem] font-semibold xl:px-3 transition-colors hover:text-[var(--sf-accent)]"
                  data-active={active || undefined}
                  style={{ color: active ? 'var(--sf-accent)' : 'var(--sf-ink)' }}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5 lg:ml-6">
            {/* On phones Compare lives in the menu (and the compare bar) until something is selected. */}
            <Link
              href="/compare"
              className={`relative size-11 place-items-center rounded-[3px] transition-colors hover:text-[var(--sf-accent)] ${savedCount > 0 ? 'grid' : 'hidden sm:grid lg:hidden'}`}
              aria-label={`Comparar vehículos${savedCount ? `, ${savedCount} seleccionados` : ''}`}
            >
              <SquareStack className="size-5" aria-hidden="true" />
              {savedCount > 0 && (
                <span
                  className="sf-figure absolute right-1 top-1 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-[2px] px-1 text-xs font-bold"
                  style={{ background: 'var(--sf-accent-fill)', color: 'var(--sf-accent-ink)' }}
                >
                  {savedCount}
                </span>
              )}
            </Link>

            <Link
              href="/account"
              aria-current={isActive(pathname, '/account') ? 'page' : undefined}
              className="hidden size-10 place-items-center rounded-[3px] transition-colors hover:text-[var(--sf-accent)] sm:grid lg:hidden 2xl:grid"
              aria-label="Mi cuenta"
            >
              <UserRound className="size-5" aria-hidden="true" />
            </Link>

            <WhatsAppButton label="WhatsApp" className="sf-btn sf-btn-outline ml-1 hidden min-h-[2.75rem] rounded-[6px] px-4 text-[0.75rem] md:inline-flex" />
            <WhatsAppButton iconOnly label="Consulta por WhatsApp" className="grid size-11 place-items-center text-[var(--sf-accent)] md:hidden" />

            <button
              ref={menuButtonRef}
              type="button"
              className="grid size-11 place-items-center rounded-[3px] transition-colors hover:text-[var(--sf-accent)] lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="storefront-mobile-menu"
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {menuOpen ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-7" strokeWidth={1.5} aria-hidden="true" />}
            </button>
          </div>
        </Container>
      </div>

      {menuOpen && (
        <div
          id="storefront-mobile-menu"
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-b lg:hidden"
          style={{ background: 'var(--sf-sign)', borderColor: 'var(--sf-rule)', boxShadow: 'var(--sf-shadow-float)' }}
        >
          <Container className="flex flex-col py-4">
            <form onSubmit={onSearch} className="relative mb-3" role="search">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: 'var(--sf-ink-3)' }} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Marca, modelo…"
                className="sf-input sf-input-icon"
                aria-label="Buscar en el inventario"
              />
            </form>
            <nav aria-label="Menú móvil">
              {MENU.map((item) => {
                const active = isActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className="sf-heading sf-caps flex min-h-12 items-center justify-between border-b text-[length:var(--sf-text-lg)] last:border-0"
                    style={{ borderColor: 'var(--sf-rule)', color: active ? 'var(--sf-accent)' : 'var(--sf-ink)' }}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            {(hasPhone || business.directionsHref) && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {hasPhone && (
                  <a href={business.phoneHref} className="sf-btn sf-btn-ghost">
                    <Phone className="size-4" aria-hidden="true" />
                    Llamar
                  </a>
                )}
                {business.directionsHref && (
                  <a href={business.directionsHref} target="_blank" rel="noreferrer" className="sf-btn sf-btn-ghost">
                    Cómo llegar
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
          </Container>
        </div>
      )}
    </header>
  )
}
