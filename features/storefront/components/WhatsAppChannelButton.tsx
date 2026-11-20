import { ELVIS_LINKS } from '../lib/elvisContent'
import { WhatsAppIcon } from './WhatsAppIcon'

/** Botón del canal de WhatsApp de Elvis: mismo tamaño y forma que el resto, en verde WhatsApp. */
export function WhatsAppChannelButton({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  return (
    <a
      href={ELVIS_LINKS.whatsappChannel}
      target="_blank"
      rel="noopener noreferrer"
      className={`sf-btn elv-wa-channel max-w-full whitespace-normal text-center ${compact ? 'sf-btn-sm min-h-11' : 'min-h-12 rounded-[8px] px-6'} ${className}`}
    >
      <WhatsAppIcon className={`${compact ? 'size-4' : 'size-5'} shrink-0`} />
      <span>Noticias y ofertas por WhatsApp</span>
    </a>
  )
}
