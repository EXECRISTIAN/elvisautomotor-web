import { Montserrat } from 'next/font/google'
import type { CSSProperties, ReactNode } from 'react'
import '@/features/storefront/styles/signage.css'
import '@/features/storefront/styles/elvis.css'
import { ComparisonBar } from './ComparisonBar'
import { Footer } from './Footer'
import { LocalSiteOverrides } from './LocalSiteOverrides'
import { Header } from './Header'
import { StorefrontBusinessProvider } from './StorefrontBusinessProvider'
import type { StorefrontSettingsState } from '../lib/business'

// Montserrat: geométrica y espaciada para títulos, legible en textos. Identidad Elvis Automotores.
const display = Montserrat({
  variable: '--font-storefront-display',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
})

type StorefrontBrandStyle = CSSProperties & {
  '--sf-logo-hue': string
}

function StorefrontUnavailable() {
  return (
    <div className={`storefront ${display.variable} min-h-screen`}>
      <main className="sf-container flex min-h-screen items-center justify-center py-16">
        <section className="max-w-md text-center" aria-live="polite">
          <h1 className="sf-display text-[length:var(--sf-text-2xl)]">No pudimos cargar esta página.</h1>
          <div className="sf-track mt-6">
            <a href="" className="sf-pill sf-pill-primary">Reintentar</a>
          </div>
        </section>
      </main>
    </div>
  )
}

export function StorefrontShell({
  children,
  settings,
}: {
  children: ReactNode
  settings: StorefrontSettingsState
}) {
  if (settings.status === 'error') {
    return <StorefrontUnavailable />
  }

  const { business } = settings
  const brandStyle: StorefrontBrandStyle = { '--sf-logo-hue': business.logoColor }
  const hideBranding = process.env.HIDE_OPENFRONT_BRANDING === 'true'

  return (
    <StorefrontBusinessProvider business={business}>
      <div
        className={`storefront ${display.variable} min-h-screen flex flex-col`}
        style={brandStyle}
      >
        <LocalSiteOverrides />
        <Header />
        <main className="sf-main flex-1">{children}</main>
        <Footer branding={!hideBranding} />
        <ComparisonBar />
      </div>
    </StorefrontBusinessProvider>
  )
}
