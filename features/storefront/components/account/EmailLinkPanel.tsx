'use client'

import { useState, useTransition } from 'react'
import { MailCheck } from 'lucide-react'

import { sendCustomerEmailVerification } from '../../actions/customerRecords'
import type { CustomerEmailLink } from '../../lib/accountRecords'
import { Notice } from '../forms/RequestForm'

export function EmailLinkPanel({ link }: { link: CustomerEmailLink | null }) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  if (!link) return null

  const send = () => {
    setResult(null)
    startTransition(async () => {
      const response = await sendCustomerEmailVerification()
      setResult(response.ok ? { tone: 'ok', text: response.message || 'Te enviamos el email de verificación.' } : { tone: 'bad', text: response.error })
    })
  }

  return (
    <section className="sf-well mt-[var(--sf-space-lg)] space-y-3 p-4 sm:p-5" aria-labelledby="email-link-title">
      <h2 id="email-link-title" className="sf-title-line">
        <span className="sf-dot" data-tone={link.verified ? 'ok' : 'warn'} aria-hidden="true" />
        <span className="sf-heading text-[length:var(--sf-text-md)]">
          {link.verified ? 'Email verificado' : 'Email sin verificar'}
        </span>
      </h2>
      {/* Only the address may break anywhere; the sentence wraps at words. */}
      <p className="sf-muted pl-4 text-[length:var(--sf-text-sm)]">
        {link.verified ? 'Las solicitudes hechas con ' : 'Verificá '}
        <span className="break-all">{link.email}</span>
        {link.verified ? ' están vinculadas a esta cuenta.' : ' para vincular las solicitudes que hiciste antes de iniciar sesión.'}
      </p>
      {result && <Notice tone={result.tone}>{result.text}</Notice>}
      <button type="button" onClick={send} disabled={pending} className={`sf-btn sf-btn-sm min-h-10 ${link.verified ? 'sf-btn-ghost' : 'sf-btn-primary'}`}>
        <MailCheck className="size-4" aria-hidden="true" />
        {pending ? 'Enviando' : link.verified ? 'Vincular solicitudes nuevas' : 'Enviar email de verificación'}
      </button>
    </section>
  )
}
