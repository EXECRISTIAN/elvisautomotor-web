import { Crown } from '@/features/rey/Crown'
import { CLUB } from '@/features/rey/club'

export default function ReyClub() {
  return (
    <section className="rey-page rey-club">
      <Crown className="rey-crown" />
      <p className="rey-kicker">Solo miembros</p>
      <h1>El Club<br /><em>de la Corona</em></h1>
      <p className="rey-lead">No te vamos a contar todo. Lo que hay adentro, se ve adentro.</p>

      <ul className="rey-locked">
        {CLUB.teasers.map((t) => (
          <li key={t.title}>
            <span className="rey-lock" aria-hidden="true">✦</span>
            <h3>{t.title}</h3>
            <p className="rey-blur" aria-hidden="true">{t.hidden}</p>
            <span className="sr-only">Contenido solo para miembros</span>
          </li>
        ))}
      </ul>

      <div className="rey-join">
        <p className="rey-price"><span>{CLUB.priceLabel}</span> / mes</p>
        <p className="rey-small">Se renueva solo cada mes. Lo cancelas cuando quieras desde Mercado Pago.</p>
        <a href="/rey/club/unirme" className="rey-btn rey-btn-gold">Quiero entrar</a>
        <p className="rey-small rey-test">Versión de muestra: el pago funciona en modo prueba, sin cobros reales.</p>
      </div>
    </section>
  )
}
