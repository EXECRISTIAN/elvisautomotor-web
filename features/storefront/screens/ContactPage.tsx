'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { submitStorefrontInquiry } from '../lib/submit'
import { Container } from '../components/Container'
import { PageHeader } from '../components/PageHeader'
import { useStorefrontBusiness } from '../components/StorefrontBusinessProvider'
import { customerRequestReference } from '../lib/customerRequests'
import { Field, Notice, RequestReceived, Sticker } from '../components/forms/RequestForm'

const CONTACT_TIMES = [
  { value: 'morning', label: 'Por la mañana' },
  { value: 'afternoon', label: 'Por la tarde' },
]

const PREFERRED_CONTACT = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'text', label: 'Mensaje de texto' },
]

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-3 text-[length:var(--sf-text-sm)]" style={{ borderColor: 'var(--sf-rule)' }}>
      <dt className="sf-muted shrink-0">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  )
}

export function ContactPage() {
  const business = useStorefrontBusiness()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    preferredContact: 'email',
    contactTimes: [] as string[],
    message: '',
    website: '',
  })
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [submitted, setSubmitted] = useState(false)
  const [submissionReference, setSubmissionReference] = useState<string | null>(null)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    setSubmissionError(null)
    try {
      const result = await submitStorefrontInquiry({
        ...formData,
        intent: 'general-contact',
        rooftopSlug: business.rooftopSlug,
        idempotencyKey,
      })
      if (!result.success) throw new Error(result.error)
      setSubmissionReference(customerRequestReference('inquiry', result.data.leadId))
      setSubmitted(true)
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'No pudimos enviar tu mensaje. Intenta de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const preferredLabel = PREFERRED_CONTACT.find((option) => option.value === formData.preferredContact)?.label

  if (submitted) {
    return (
      <RequestReceived
        context="Mensaje"
        reference={submissionReference}
        summary={
          <Sticker
            title="Mensaje"
            meta={business.shortName || business.fullName}
            rows={[
              { label: 'Nombre', value: [formData.firstName, formData.lastName].filter(Boolean).join(' ') },
              { label: 'Respuesta por', value: preferredLabel, strong: true },
              ...(formData.contactTimes.length ? [{ label: 'Horario', value: formData.contactTimes.map((t) => CONTACT_TIMES.find((o) => o.value === t)?.label ?? t).join(' y ').replace(' y Por', ' y por') }] : []),
              { label: 'Email', value: formData.email },
              ...(formData.phone ? [{ label: 'Teléfono', value: formData.phone }] : []),
            ]}
          />
        }
        actions={
          <>
            <Link href="/" className="sf-btn sf-btn-primary">Volver al inicio</Link>
            <Link href="/inventory" className="sf-btn sf-btn-ghost">Inventario</Link>
          </>
        }
      />
    )
  }

  const hasAddress = Boolean(business.addressLine1 || business.addressLine2)
  const hours = [
    { label: 'Lun–Vie', value: business.hoursMonFri },
    { label: 'Sábado', value: business.hoursSaturday },
    { label: 'Domingo', value: business.hoursSunday },
  ].filter((row) => row.value)
  const departments = [
    business.salesEmail ? { label: 'Ventas', email: business.salesEmail } : null,
    business.serviceEmail ? { label: 'Taller', email: business.serviceEmail } : null,
  ].filter((row): row is { label: string; email: string } => Boolean(row))

  return (
    <>
      <PageHeader title="Contacto" />

      <Container className="sf-section">
        <div className="grid gap-[var(--sf-space-xl)] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] xl:gap-[var(--sf-space-2xl)]">
          <aside className="order-2 min-w-0 space-y-[var(--sf-space-lg)] lg:order-1">
            <section>
              <h2 className="sf-heading mb-3 text-[length:var(--sf-text-lg)]">Visítanos</h2>
              {hasAddress ? (
                <>
                  <address className="not-italic">
                    {business.addressLine1 && <p className="text-[length:var(--sf-text-lg)] font-semibold">{business.addressLine1}</p>}
                    {business.addressLine2 && <p className="sf-muted mt-1">{business.addressLine2}</p>}
                  </address>
                  {business.directionsHref && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href={business.directionsHref} target="_blank" rel="noopener noreferrer" className="sf-btn sf-btn-primary">
                        Cómo llegar
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                      </a>
                      {business.phoneHref && business.phoneDisplay && (
                        <a href={business.phoneHref} className="sf-btn sf-btn-ghost">Llamar</a>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="sf-muted text-[length:var(--sf-text-sm)]">Dirección no informada</p>
              )}
            </section>

            <section>
              <h2 className="sf-heading mb-3 text-[length:var(--sf-text-lg)]">Áreas</h2>
              {business.phoneDisplay || departments.length ? (
                <dl className="border-t" style={{ borderColor: 'var(--sf-rule)' }}>
                  {business.phoneHref && business.phoneDisplay && (
                    <InfoRow label="Teléfono">
                      <a href={business.phoneHref} className="sf-link sf-figure">{business.phoneDisplay}</a>
                    </InfoRow>
                  )}
                  {departments.map((row) => (
                    <InfoRow key={row.label} label={row.label}>
                      <a href={`mailto:${row.email}`} className="sf-link break-all">{row.email}</a>
                    </InfoRow>
                  ))}
                </dl>
              ) : (
                <p className="sf-muted text-[length:var(--sf-text-sm)]">Datos de contacto no informados</p>
              )}
            </section>

            <section>
              <h2 className="sf-heading mb-3 text-[length:var(--sf-text-lg)]">Horarios</h2>
              {hours.length ? (
                <dl className="border-t" style={{ borderColor: 'var(--sf-rule)' }}>
                  {hours.map((row) => (
                    <InfoRow key={row.label} label={row.label}>
                      <span className="sf-figure">{row.value}</span>
                    </InfoRow>
                  ))}
                </dl>
              ) : (
                <p className="sf-muted text-[length:var(--sf-text-sm)]">Horarios no informados</p>
              )}
            </section>
          </aside>

          <form onSubmit={handleSubmit} className="order-1 min-w-0 lg:order-2 lg:border-l lg:pl-[var(--sf-space-xl)]" style={{ borderColor: 'var(--sf-rule)' }}>
            <h2 className="sf-heading mb-5 text-[length:var(--sf-text-xl)]">Mensaje</h2>
            <div className="grid gap-4">
              <Field label="Nombre" htmlFor="contact-first-name">
                <input
                  id="contact-first-name"
                  type="text"
                  required
                  autoComplete="given-name"
                  value={formData.firstName}
                  onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))}
                  className="sf-input"
                />
              </Field>
              <Field label="Apellido" htmlFor="contact-last-name">
                <input
                  id="contact-last-name"
                  type="text"
                  required
                  autoComplete="family-name"
                  value={formData.lastName}
                  onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))}
                  className="sf-input"
                />
              </Field>
              <Field label="Email" htmlFor="contact-email">
                <input
                  id="contact-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  className="sf-input"
                />
              </Field>
              <Field label="Teléfono" htmlFor="contact-phone" optional={formData.preferredContact === 'email'}>
                <input
                  id="contact-phone"
                  type="tel"
                  autoComplete="tel"
                  required={formData.preferredContact !== 'email'}
                  value={formData.phone}
                  onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                  className="sf-input"
                />
              </Field>
              <div>
                <p id="contact-preferred" className="sf-label">Prefieres que te contactemos por</p>
                <div role="group" aria-labelledby="contact-preferred" className="sf-track sf-track-choices">
                  {PREFERRED_CONTACT.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className="sf-pill min-h-11 px-5"
                      aria-pressed={formData.preferredContact === option.value}
                      onClick={() => setFormData((p) => ({ ...p, preferredContact: option.value }))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p id="contact-times" className="sf-label">¿En qué momento te queda mejor?</p>
                <div role="group" aria-labelledby="contact-times" className="sf-track sf-track-choices">
                  {CONTACT_TIMES.map((option) => {
                    const on = formData.contactTimes.includes(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className="sf-pill min-h-11 px-5"
                        aria-pressed={on}
                        onClick={() => setFormData((p) => ({ ...p, contactTimes: on ? p.contactTimes.filter((t) => t !== option.value) : [...p.contactTimes, option.value] }))}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
                <p className="sf-faint mt-1 text-[length:var(--sf-text-xs)]">Puedes elegir una o las dos.</p>
              </div>
              <Field label="Mensaje" htmlFor="contact-message">
                <textarea
                  id="contact-message"
                  required
                  rows={6}
                  value={formData.message}
                  onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
                  className="sf-input"
                />
              </Field>
            </div>
            <input
              type="text"
              name="website"
              value={formData.website}
              onChange={(e) => setFormData((p) => ({ ...p, website: e.target.value }))}
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />
            <div className="mt-6 space-y-4">
              {submissionError && <Notice tone="bad">{submissionError}</Notice>}
              <button type="submit" disabled={isSubmitting} className="sf-btn sf-btn-primary w-full sm:w-auto sm:min-w-56">
                {isSubmitting ? 'Enviando…' : 'Quiero que me contacten'}
              </button>
            </div>
          </form>
        </div>
      </Container>
    </>
  )
}
