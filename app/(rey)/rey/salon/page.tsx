import { WeekdayHours } from '@/features/storefront/components/WeekdayHours'
import { loadStorefrontBusiness } from '@/features/storefront/lib/data/storefront-business'
import { ELVIS_LINKS } from '@/features/storefront/lib/elvisContent'
import { whatsappHref } from '@/features/storefront/lib/whatsapp'

export const dynamic = 'force-dynamic'

export default async function ReySalon() {
  const settings = await loadStorefrontBusiness()
  const b = settings.status === 'ready' ? settings.business : null
  const wa = b ? whatsappHref(b.whatsappNumber, 'Hola Elvis, quiero pasar por el salón.') : ''
  return (
    <section className="rey-page">
      <p className="rey-kicker">El Salón</p>
      <h1>Las cosas importantes<br /><em>se hablan en persona.</em></h1>
      <img src="/images/elvis/salon-interior.jpg" alt="Interior del salón de Elvis Automotores" className="rey-photo" />
      <dl className="rey-info">
        {b?.addressLine1 && <div><dt>Dónde</dt><dd>{b.addressLine1}{b.addressLine2 ? `, ${b.addressLine2}` : ''}</dd></div>}
        {b?.hoursMonFri && <div><dt>Lun–Vie</dt><dd><WeekdayHours value={b.hoursMonFri} /></dd></div>}
        {b?.hoursSaturday && <div><dt>Sábados</dt><dd>{b.hoursSaturday}</dd></div>}
      </dl>
      <div className="rey-ctas">
        <a href={ELVIS_LINKS.maps} target="_blank" rel="noreferrer" className="rey-btn rey-btn-gold">Cómo llegar</a>
        {wa && <a href={wa} target="_blank" rel="noreferrer" className="rey-btn">WhatsApp</a>}
        {b?.phoneHref && <a href={b.phoneHref} className="rey-btn rey-btn-ghost">Llamar</a>}
      </div>
    </section>
  )
}
