import Link from 'next/link'

import { Crown } from '@/features/rey/Crown'
import { loadStorefrontBusiness } from '@/features/storefront/lib/data/storefront-business'
import { whatsappHref } from '@/features/storefront/lib/whatsapp'

export const dynamic = 'force-dynamic'

export default async function ReyHome() {
  const settings = await loadStorefrontBusiness()
  const b = settings.status === 'ready' ? settings.business : null
  const wa = b ? whatsappHref(b.whatsappNumber, 'Hola Elvis, quiero pasar por el salón.') : ''
  return (
    <>
      <section className="rey-hero">
        <picture>
          <source media="(max-width: 767px)" srcSet="/images/elvis/salon-frente-movil.jpg" />
          <img src="/images/elvis/salon-frente.jpg" alt="" className="rey-hero-img" />
        </picture>
        <div className="rey-hero-in">
          <Crown className="rey-crown" />
          <p className="rey-kicker">Quilmes · desde 2009</p>
          <h1>El Rey<br /><em>no publica todo.</em></h1>
          <p className="rey-lead">Los mejores autos se ven en persona. Lo demás, se descubre.</p>
          <div className="rey-ctas">
            <Link href="/rey/salon" className="rey-btn rey-btn-gold">Ven al salón</Link>
            {wa && <a href={wa} target="_blank" rel="noreferrer" className="rey-btn">Escríbenos</a>}
            <Link href="/rey/club" className="rey-btn rey-btn-ghost">Entrar al Club <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <section className="rey-strip" aria-label="Cómo trabajamos">
        <div><span>I</span><p>Ven al salón</p></div>
        <div><span>II</span><p>Lo hablamos en persona</p></div>
        <div><span>III</span><p>Te vas manejando</p></div>
      </section>

      <section className="rey-tease">
        <Crown className="rey-crown-sm" />
        <h2>El Club de la Corona</h2>
        <p>Hay una puerta en el salón que no todos cruzan.</p>
        <Link href="/rey/club" className="rey-btn rey-btn-gold">Descubrir</Link>
      </section>
    </>
  )
}
