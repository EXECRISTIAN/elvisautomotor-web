'use client'

import Link from 'next/link'
import { useStorefrontBusiness } from './StorefrontBusinessProvider'

// Monograma AE + logotipo "ELVIS / AUTOMOTORES" (recreado en vector a partir del logo original).
export function splitBrandName(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return { lead: name.trim(), rest: '' }
  return { lead: words[0], rest: words.slice(1).join(' ') }
}

export function AeMonogram({ className = 'h-10 w-auto' }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/elvis-ae.svg" alt="" width={72} height={100} className={className} />
  )
}

export function BrandMark({ size = 'md', className = '' }: { size?: 'md' | 'lg'; className?: string }) {
  const business = useStorefrontBusiness()
  const { lead, rest } = splitBrandName(business.shortName)
  const large = size === 'lg'

  return (
    <Link href="/" className={`flex min-h-11 min-w-0 items-center gap-3 md:gap-4 ${className}`} title={business.shortName}>
      <AeMonogram className={large ? 'h-14 w-auto' : 'h-9 w-auto md:h-11'} />
      <span className="h-9 w-px md:h-11" style={{ background: 'var(--sf-rule-strong)' }} aria-hidden="true" />
      <span className="flex min-w-0 flex-col leading-none">
        <span className={`truncate font-semibold uppercase ${large ? 'text-[1.75rem]' : 'text-[1.25rem] md:text-[1.6rem]'}`} style={{ color: 'var(--sf-bone)', letterSpacing: '0.22em', lineHeight: 1 }}>
          {lead}
        </span>
        {rest && (
          <span className={`sf-gold-text truncate font-medium uppercase ${large ? 'text-[0.8rem]' : 'text-[0.62rem] md:text-[0.72rem]'}`} style={{ letterSpacing: '0.42em', marginTop: '0.45em' }}>
            {rest}
          </span>
        )}
        <span className="sr-only">, inicio</span>
      </span>
    </Link>
  )
}
