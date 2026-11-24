import Link from 'next/link'
import { Container } from './Container'

const SHORTCUTS = [
  { href: '/', label: 'Inicio' },
  { href: '/inventory', label: 'Inventario' },
  { href: '/ofertas', label: 'Ofertas' },
  { href: '/financing', label: 'Financiación' },
  { href: '/trade-in', label: 'Vende tu auto' },
  { href: '/contact', label: 'Contacto' },
]

export function PageNotFound() {
  return (
    <Container className="py-[var(--sf-space-2xl)]">
      <div className="sf-well flex flex-col items-start gap-5 p-6 md:p-8">
        <h1 className="sf-title-line sf-heading text-[length:var(--sf-text-xl)]">
          <span className="sf-dot" aria-hidden="true" />
          Página no encontrada
        </h1>
        <p className="sf-copy">La página que buscas no existe o se movió. Puedes buscar un auto o ir a una sección:</p>
        <form action="/inventory" method="get" role="search" className="flex w-full max-w-md gap-2">
          <label htmlFor="nf-search" className="sr-only">Buscar auto</label>
          <input id="nf-search" name="search" type="search" placeholder="Marca, modelo o patente" className="sf-input min-w-0 flex-1" />
          <button type="submit" className="sf-btn sf-btn-primary">Buscar</button>
        </form>
        <nav aria-label="Accesos rápidos" className="flex flex-wrap gap-2">
          {SHORTCUTS.map((s, i) => (
            <Link key={s.href} href={s.href} className={i === 0 ? 'sf-btn sf-btn-primary' : 'sf-btn sf-btn-ghost'}>{s.label}</Link>
          ))}
        </nav>
      </div>
    </Container>
  )
}
