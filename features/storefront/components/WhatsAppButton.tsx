'use client'

import { whatsappHref } from '../lib/whatsapp'
import { useStorefrontBusiness } from './StorefrontBusinessProvider'
import { WhatsAppIcon } from './WhatsAppIcon'

// Botón de consulta por WhatsApp. Si el número no está configurado en el panel, no se muestra
// (nunca dejamos un botón sin funcionamiento).
export function WhatsAppButton({
  message,
  label = 'Consultá por WhatsApp',
  className = 'sf-btn sf-btn-outline',
  iconOnly = false,
}: {
  message?: string
  label?: string
  className?: string
  iconOnly?: boolean
}) {
  const business = useStorefrontBusiness()
  const href = whatsappHref(business.whatsappNumber, message ?? `Hola ${business.shortName}, quiero hacer una consulta.`)
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} aria-label={iconOnly ? label : undefined}>
      <WhatsAppIcon className="size-5 shrink-0" />
      {!iconOnly && <span>{label}</span>}
    </a>
  )
}
