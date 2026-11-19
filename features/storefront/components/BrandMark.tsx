'use client'

import Link from 'next/link'
import { ElvisLogo } from './ElvisLogo'
import { useStorefrontBusiness } from './StorefrontBusinessProvider'

export function splitBrandName(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return { lead: name.trim(), rest: '' }
  return { lead: words[0], rest: words.slice(1).join(' ') }
}

// Imagotipo completo (isotipo AE + barra + "ELVIS AUTOMOTORES") en un solo SVG embebido.
export function BrandMark({ size = 'md', className = '' }: { size?: 'md' | 'lg'; className?: string }) {
  const business = useStorefrontBusiness()
  return (
    <Link href="/" className={`flex min-h-11 min-w-0 items-center ${className}`} aria-label={`${business.shortName}, inicio`}>
      <ElvisLogo title={business.shortName} className={size === 'lg' ? 'h-14 w-auto' : 'h-10 w-auto md:h-12'} />
    </Link>
  )
}
