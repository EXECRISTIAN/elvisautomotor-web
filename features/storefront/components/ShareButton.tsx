'use client'

import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'

/** Compartir la ficha: menú del sistema en celular (WhatsApp, Instagram…); copia el enlace en computadora. */
export function ShareButton({ title, text, className = '' }: { title: string; text?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) { await navigator.share({ title, text: text || title, url }); return }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const input = Object.assign(document.createElement('textarea'), { value: url })
      document.body.append(input); input.select(); document.execCommand('copy'); input.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2500)
  }
  return (
    <button type="button" onClick={share} className={`sf-btn sf-btn-ghost min-h-11 ${className}`} aria-live="polite">
      {copied ? <Check className="size-4" aria-hidden="true" /> : <Share2 className="size-4" aria-hidden="true" />}
      {copied ? 'Enlace copiado' : 'Compartir'}
    </button>
  )
}
