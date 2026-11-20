import { ELVIS_LINKS } from '../lib/elvisContent'
import { WhatsAppIcon } from './WhatsAppIcon'

/** Botón llamativo del canal de WhatsApp de Elvis (noticias y ofertas). */
export function WhatsAppChannelButton({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  return (
    <a
      href={ELVIS_LINKS.whatsappChannel}
      target="_blank"
      rel="noopener noreferrer"
      className={`elv-wa-channel ${compact ? 'elv-wa-channel-compact' : ''} ${className}`}
    >
      <span className="elv-wa-channel-icon" aria-hidden="true"><WhatsAppIcon className="size-6" /></span>
      <span className="min-w-0 text-left">
        <span className="block font-bold uppercase tracking-[0.04em]">Noticias y ofertas por WhatsApp</span>
        {!compact && <span className="block text-[0.8rem] font-medium opacity-90">Únete al canal de Elvis: avisamos primero las ofertas.</span>}
      </span>
    </a>
  )
}
