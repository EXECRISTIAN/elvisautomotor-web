import Link from 'next/link'

import { Crown } from '@/features/rey/Crown'

export default function ReyUnirme() {
  return (
    <section className="rey-page rey-club">
      <Crown className="rey-crown" />
      <p className="rey-kicker">Muy pronto</p>
      <h1>La puerta<br /><em>se está abriendo.</em></h1>
      <p className="rey-lead">El alta con Mercado Pago llega en la próxima versión de la muestra.</p>
      <div className="rey-ctas"><Link href="/rey/club" className="rey-btn">Volver</Link></div>
    </section>
  )
}
