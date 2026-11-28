import type { Metadata } from 'next'
import Link from 'next/link'
import { Cormorant_Garamond, Montserrat } from 'next/font/google'

import { ElvisLogo } from '@/features/storefront/components/ElvisLogo'
import { SocialIcon } from '@/features/storefront/components/SocialIcon'
import { ELVIS_LINKS } from '@/features/storefront/lib/elvisContent'
import '@/features/rey/rey.css'

const serif = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'], variable: '--rey-serif' })
const sans = Montserrat({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--rey-sans' })

export const metadata: Metadata = {
  title: 'Elvis Automotores',
  description: 'Ven al salón. Algunas cosas no se publican.',
  robots: { index: false, follow: false },
}

const SOCIAL = ELVIS_LINKS.social.filter((s) => ['Instagram', 'Facebook', 'TikTok'].includes(s.label))

export default function ReyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`rey ${serif.variable} ${sans.variable}`}>
      <header className="rey-top">
        <Link href="/rey" aria-label="Elvis Automotores, inicio"><ElvisLogo className="rey-logo" /></Link>
        <nav aria-label="Principal">
          <Link href="/rey/salon">El Salón</Link>
          <Link href="/rey/club" className="rey-nav-club">El Club</Link>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="rey-foot">
        <div className="rey-social">
          {SOCIAL.map((s) => (
            <a key={s.href} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label}><SocialIcon label={s.label} className="size-5" /></a>
          ))}
        </div>
        <p>© Elvis Automotores · Quilmes</p>
      </footer>
    </div>
  )
}
