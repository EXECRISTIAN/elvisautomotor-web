'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Landmark } from 'lucide-react'
import { PlatformSelect } from '@/features/platform/components/PlatformSelect'
import { fetchGraphQL } from '@/features/storefront/lib/data/public-read'
import { GET_VEHICLES } from '@/features/storefront/lib/data/queries'
import type { Vehicle } from '@/features/storefront/lib/types'
import { SIMULATION_DISCLAIMER, formatBpsPercent, simulate, termRange, type AmortizationSystem } from '@/features/lib/financing/simulate'
import { normalizeMoneyText } from '@/features/platform/deals/lib/moneyInput'
import { submitStorefrontFinancing } from '../lib/submit'
import { PageHeader } from '../components/PageHeader'
import { useStorefrontBusiness } from '../components/StorefrontBusinessProvider'
import { WhatsAppButton } from '../components/WhatsAppButton'
import { formatPrice, vehicleTitle } from '../lib/format'
import { customerRequestReference } from '../lib/customerRequests'
import { ELVIS_ABOUT, ELVIS_BANKS, ELVIS_INFO } from '../lib/elvisContent'
import { fillBlankFields, useCustomerPrefill } from '../lib/useCustomerPrefill'
import { Field, FormSection, MobileSummary, Notice, RequestLayout, RequestReceived, Sticker, type StickerRowData } from '../components/forms/RequestForm'

export type PublicFinancingPlan = {
  id: string
  bankName: string
  name: string
  tnaBps: number
  teaBps: number | null
  cftBps: number | null
  termsMonths: number[]
  minAmountCents: number | null
  maxAmountCents: number | null
  maxFinancedBps: number | null
  amortization: AmortizationSystem
  validUntil: string | null
  extraCosts: string
  requirements: string
}

const EMPLOYMENT = [
  { value: 'employed', label: 'Empleado' },
  { value: 'self-employed', label: 'Independiente / autónomo' },
  { value: 'retired', label: 'Jubilado / pensionado' },
  { value: 'other', label: 'Otra' },
]
const CREDIT = [
  { value: 'excellent-720-plus', label: 'Muy buena, sin deudas' },
  { value: 'good-680-719', label: 'Buena' },
  { value: 'fair-620-679', label: 'Regular' },
  { value: 'rebuilding-under-620', label: 'Con deudas / en recuperación' },
  { value: 'not-sure', label: 'No sé' },
]

/** "54.900.000" -> 54900000 (pesos). Vacío o inválido -> null. */
function parsePesos(text: string) {
  const normalized = normalizeMoneyText(text)
  if (!normalized) return null
  const value = Number(normalized)
  return Number.isFinite(value) && value >= 0 ? value : null
}

export function FinancingPage({ plans, initialVehicles }: { plans: PublicFinancingPlan[]; initialVehicles?: Vehicle[] | null }) {
  const business = useStorefrontBusiness()
  const money = (pesos: number) => formatPrice(pesos, business.currencyCode || 'ARS')
  const searchParams = useSearchParams()
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(initialVehicles ?? null)
  const [vehicleId, setVehicleId] = useState(searchParams?.get('vehicleId') || '')
  const [manualPrice, setManualPrice] = useState('')
  const [downPayment, setDownPayment] = useState('')
  const [planId, setPlanId] = useState(plans[0]?.id || '')
  const [term, setTerm] = useState<number>(plans[0]?.termsMonths[0] || 0)
  const [customTerm, setCustomTerm] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', employmentStatus: '', monthlyIncome: '', creditTier: '', consent: false, privacyAcknowledged: false, website: '' })
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)
  const prefill = useCustomerPrefill()

  useEffect(() => {
    if (prefill) setForm((prev) => fillBlankFields(prev, { fullName: [prefill.firstName, prefill.lastName].filter(Boolean).join(' '), email: prefill.email, phone: prefill.phone }))
  }, [prefill])

  useEffect(() => {
    if (initialVehicles) return
    let active = true
    void fetchGraphQL<{ publicInventoryVehicles: { items: Vehicle[] } }>(GET_VEHICLES, { where: { status: { equals: 'available' } }, orderBy: [{ year: 'desc' }], take: 100 })
      .then((data) => { if (active) setVehicles(data.publicInventoryVehicles?.items ?? []) })
      .catch(() => { if (active) setVehicles([]) })
    return () => { active = false }
  }, [initialVehicles])

  const vehicle = vehicles?.find((item) => item.id === vehicleId) ?? null
  const price = vehicle && vehicle.price > 0 ? vehicle.price : parsePesos(manualPrice)
  const down = parsePesos(downPayment) ?? 0
  const plan = plans.find((item) => item.id === planId) ?? null

  const result = useMemo(() => {
    if (!plan || !price || !term) return null
    return simulate(plan, { priceCents: Math.round(price * 100), downPaymentCents: Math.round(down * 100), termMonths: term })
  }, [plan, price, down, term])

  const choosePlan = (id: string) => {
    setPlanId(id)
    const next = plans.find((item) => item.id === id)
    if (next) {
      const [minTerm, maxTerm] = termRange(next.termsMonths)
      if (customTerm ? term < minTerm || term > maxTerm : !next.termsMonths.includes(term)) setTerm(next.termsMonths[0])
    }
  }

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    if (sending) return
    setSending(true)
    setError(null)
    try {
      const income = parsePesos(form.monthlyIncome)
      if (!income) throw new Error('Ingresa tus ingresos mensuales aproximados.')
      const response = await submitStorefrontFinancing({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        employmentStatus: form.employmentStatus,
        annualIncome: income * 12,
        creditTier: form.creditTier,
        consent: form.consent,
        privacyAcknowledged: form.privacyAcknowledged,
        website: form.website,
        rooftopSlug: business.rooftopSlug,
        idempotencyKey,
        vehicleId: vehicle?.id,
        downPayment: down,
        ...(plan && result?.ok && price
          ? { financingPlanId: plan.id, loanTerm: term, vehiclePrice: price, requestedAmount: result.financedCents / 100, monthlyPayment: result.firstInstallmentCents / 100, apr: plan.tnaBps / 100 }
          : { requestedAmount: price ? Math.max(price - down, 0) : null }),
      })
      if (!response.success) throw new Error(response.error)
      setReference(response.data.applicationReference || customerRequestReference('financing', response.data.applicationId))
      setIdempotencyKey(crypto.randomUUID())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos enviar la solicitud. Intenta de nuevo.')
    } finally {
      setSending(false)
    }
  }

  const rows: StickerRowData[] = [
    { label: 'Vehículo', value: vehicle ? vehicleTitle(vehicle) : price ? 'Otro / a definir' : null, strong: true },
    { label: 'Precio', value: price ? money(price) : null },
    { label: 'Anticipo', value: money(down) },
    ...(plan ? [{ label: 'Plan', value: `${plan.bankName} — ${plan.name}` }] : []),
    ...(result?.ok ? [
      { label: 'A financiar', value: money(result.financedCents / 100) },
      { label: plan?.amortization === 'aleman' ? 'Primera cuota' : 'Cuota estimada', value: <span className="sf-figure">{money(result.firstInstallmentCents / 100)}</span>, strong: true },
      ...(plan?.amortization === 'aleman' ? [{ label: 'Última cuota', value: money(result.lastInstallmentCents / 100) }] : []),
      { label: 'Plazo', value: `${result.termMonths} meses` },
    ] : []),
  ]
  const summary = (
    <Sticker title="Simulación" meta="Estimativa" rows={rows}>
      <p className="sf-muted px-4 pb-3 text-[length:var(--sf-text-xs)]">{SIMULATION_DISCLAIMER}</p>
    </Sticker>
  )

  if (reference) {
    return (
      <RequestReceived
        context="Financiación"
        reference={reference}
        note={`Un asesor revisa tu consulta y te contacta. ${ELVIS_ABOUT.creditDisclaimer}`}
        summary={summary}
        actions={
          <>
            <Link href="/inventory" className="sf-btn sf-btn-primary">Ver inventario</Link>
            <WhatsAppButton label="Consultar por WhatsApp" message={`Hola ${business.shortName}, envié una consulta de financiación (referencia ${reference}).`} className="sf-btn sf-btn-ghost" />
          </>
        }
      />
    )
  }

  return (
    <>
      <PageHeader title="Financiación" />
      <RequestLayout summary={summary}>
        <div className="space-y-[var(--sf-space-lg)]">
          <div className="sf-well flex gap-4 p-5">
            <Landmark className="mt-0.5 size-8 shrink-0" strokeWidth={1.3} style={{ color: 'var(--sf-accent)' }} aria-hidden="true" />
            <div className="space-y-2 text-[length:var(--sf-text-sm)]">
              <p>{ELVIS_ABOUT.credit}</p>
              <p>Trabajamos con {ELVIS_BANKS.join(' y ')}.</p>
              <p className="sf-muted">{ELVIS_ABOUT.creditVisit} {ELVIS_ABOUT.creditDisclaimer}</p>
              <p className="sf-faint">{ELVIS_INFO.demand}</p>
            </div>
          </div>

          <Link href="/precalificador" className="sf-well flex min-h-16 items-center justify-between gap-4 p-5 transition-colors hover:border-[var(--sf-accent)]" style={{ borderColor: 'var(--sf-accent)' }}>
            <span>
              <span className="block font-bold">¿Quieres saber si calificas para un 0 km?</span>
              <span className="sf-muted block text-[length:var(--sf-text-sm)]">Responde unas preguntas rápidas en el precalificador y un vendedor te escribe por WhatsApp.</span>
            </span>
            <span className="sf-btn sf-btn-primary shrink-0 rounded-[8px]">Precalificar</span>
          </Link>

          <FormSection title="1. Simula tu cuota" first>
            <div className="grid gap-4">
              <Field label="Vehículo" htmlFor="fin-vehicle">
                <PlatformSelect
                  id="fin-vehicle"
                  value={vehicleId}
                  onValueChange={setVehicleId}
                  className="sf-input sf-trigger"
                  placeholder={vehicles === null ? 'Cargando inventario…' : 'Elige un vehículo'}
                  searchable
                  options={[{ value: '', label: 'Otro / todavía no lo elegí' }, ...(vehicles ?? []).map((item) => ({ value: item.id, label: `${vehicleTitle(item)} — ${item.price > 0 ? money(item.price) : 'consultar'}` }))]}
                />
              </Field>
              {!vehicle && (
                <Field label="Precio del vehículo" htmlFor="fin-price">
                  <input id="fin-price" inputMode="decimal" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} className="sf-input sf-figure" placeholder="Ej.: 25.000.000" />
                </Field>
              )}
              <Field label="¿Cuánto puedes entregar?" htmlFor="fin-down">
                <input id="fin-down" inputMode="decimal" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} className="sf-input sf-figure" placeholder="Ej.: 8.000.000 (puedes incluir tu usado)" />
              </Field>

              {plans.length === 0 ? (
                <Notice tone="warn">
                  Todavía no hay planes bancarios publicados. Consulta tu crédito de forma presencial y gratuita en nuestro salón, o escríbenos y te asesoramos.
                </Notice>
              ) : (
                <>
                  <fieldset>
                    <legend className="sf-label">Banco y plan</legend>
                    <div className="grid gap-2">
                      {plans.map((item) => (
                        <label key={item.id} className="sf-well flex cursor-pointer items-start gap-3 p-4" data-active={item.id === planId || undefined} style={item.id === planId ? { borderColor: 'var(--sf-accent)', boxShadow: 'inset 0 0 0 1px var(--sf-accent)' } : undefined}>
                          <input type="radio" name="plan" value={item.id} checked={item.id === planId} onChange={() => choosePlan(item.id)} className="mt-1" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold">{item.bankName} — {item.name}</span>
                            <span className="sf-muted mt-1 block text-[length:var(--sf-text-sm)]">
                              TNA {formatBpsPercent(item.tnaBps)}{item.teaBps != null ? ` · TEA ${formatBpsPercent(item.teaBps)}` : ''}{item.cftBps != null ? ` · CFT ${formatBpsPercent(item.cftBps)}` : ''} · Sistema {item.amortization === 'aleman' ? 'alemán' : 'francés'}
                              {item.maxFinancedBps != null ? ` · Financia hasta el ${formatBpsPercent(item.maxFinancedBps)}` : ''}
                              {item.validUntil ? ` · Vigente hasta ${new Date(item.validUntil).toLocaleDateString('es-AR')}` : ''}
                            </span>
                            {item.extraCosts && <span className="sf-faint mt-1 block text-[length:var(--sf-text-xs)]">Gastos: {item.extraCosts}</span>}
                            {item.requirements && <span className="sf-faint mt-1 block text-[length:var(--sf-text-xs)]">Requisitos: {item.requirements}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {plan && (
                    <fieldset>
                      <legend className="sf-label">Cantidad de cuotas</legend>
                      <div className="sf-track flex-wrap" role="group">
                        {plan.termsMonths.map((months) => (
                          <button key={months} type="button" className="sf-pill min-h-11 min-w-11" aria-pressed={!customTerm && term === months} onClick={() => { setCustomTerm(false); setTerm(months) }}>{months}</button>
                        ))}
                        <button type="button" className="sf-pill min-h-11" aria-pressed={customTerm} aria-expanded={customTerm} aria-controls="custom-term" onClick={() => setCustomTerm(true)}>Otra cantidad</button>
                      </div>
                      {customTerm && (() => {
                        const [minTerm, maxTerm] = termRange(plan.termsMonths)
                        const clamp = (value: number) => Math.min(maxTerm, Math.max(minTerm, Math.round(value) || minTerm))
                        return (
                          <div id="custom-term" className="mt-3">
                            <div className="flex items-stretch gap-2">
                              <button type="button" className="sf-btn sf-btn-ghost min-h-12 min-w-12 rounded-[8px] px-0 text-[1.25rem]" aria-label="Una cuota menos" disabled={term <= minTerm} onClick={() => setTerm(clamp(term - 1))}>−</button>
                              <label className="sr-only" htmlFor="custom-term-input">Cantidad de cuotas</label>
                              <input id="custom-term-input" type="number" inputMode="numeric" min={minTerm} max={maxTerm} step={1} value={term || ''} onChange={(e) => setTerm(Number(e.target.value))} onBlur={() => setTerm(clamp(term))} className="sf-input sf-figure min-h-12 w-24 text-center text-[1.1rem]" />
                              <button type="button" className="sf-btn sf-btn-ghost min-h-12 min-w-12 rounded-[8px] px-0 text-[1.25rem]" aria-label="Una cuota más" disabled={term >= maxTerm} onClick={() => setTerm(clamp(term + 1))}>+</button>
                            </div>
                            <input type="range" min={minTerm} max={maxTerm} step={1} value={Math.min(maxTerm, Math.max(minTerm, term || minTerm))} onChange={(e) => setTerm(Number(e.target.value))} className="mt-3 w-full max-w-sm accent-[var(--sf-accent)]" aria-label="Cantidad de cuotas" />
                            <p className="sf-faint mt-1 text-[length:var(--sf-text-xs)]">Entre {minTerm} y {maxTerm} cuotas. El banco confirma los plazos disponibles.</p>
                          </div>
                        )
                      })()}
                    </fieldset>
                  )}
                  {result && !result.ok && <Notice tone="warn">{result.reason}</Notice>}
                  {result?.ok && (
                    <div className="sf-well p-5" aria-live="polite">
                      <p className="sf-label">{plan?.amortization === 'aleman' ? 'Primera cuota estimada' : 'Cuota estimada'}</p>
                      <p className="sf-price text-[2rem]">{money(result.firstInstallmentCents / 100)}</p>
                      <p className="sf-muted text-[length:var(--sf-text-sm)]">
                        {result.termMonths} cuotas · A financiar {money(result.financedCents / 100)}
                        {plan?.amortization === 'aleman' ? ` · Última cuota ${money(result.lastInstallmentCents / 100)}` : ''}
                      </p>
                      <p className="sf-faint mt-3 text-[length:var(--sf-text-xs)]">{SIMULATION_DISCLAIMER}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </FormSection>

          <form onSubmit={send} className="space-y-[var(--sf-space-lg)]">
            <input type="text" name="website" value={form.website} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            <FormSection title="2. Envía tu solicitud">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre y apellido" htmlFor="fin-name" className="sm:col-span-2">
                  <input id="fin-name" required autoComplete="name" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} className="sf-input" />
                </Field>
                <Field label="Email" htmlFor="fin-email">
                  <input id="fin-email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="sf-input" />
                </Field>
                <Field label="Teléfono / WhatsApp" htmlFor="fin-phone">
                  <input id="fin-phone" type="tel" required autoComplete="tel" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="sf-input" />
                </Field>
                <Field label="Situación laboral" htmlFor="fin-employment">
                  <PlatformSelect id="fin-employment" required value={form.employmentStatus} onValueChange={(v) => setForm((p) => ({ ...p, employmentStatus: v }))} className="sf-input sf-trigger" placeholder="Elige una opción" options={EMPLOYMENT} />
                </Field>
                <Field label="Ingresos mensuales aproximados" htmlFor="fin-income">
                  <input id="fin-income" required inputMode="decimal" value={form.monthlyIncome} onChange={(e) => setForm((p) => ({ ...p, monthlyIncome: e.target.value }))} className="sf-input sf-figure" placeholder="Ej.: 1.500.000" />
                </Field>
                <Field label="Situación crediticia" htmlFor="fin-credit" className="sm:col-span-2">
                  <PlatformSelect id="fin-credit" required value={form.creditTier} onValueChange={(v) => setForm((p) => ({ ...p, creditTier: v }))} className="sf-input sf-trigger" placeholder="Elige una opción" options={CREDIT} />
                </Field>
              </div>
              <div className="mt-4 space-y-3 text-[length:var(--sf-text-sm)]">
                <label className="flex items-start gap-3"><input type="checkbox" required checked={form.consent} onChange={(e) => setForm((p) => ({ ...p, consent: e.target.checked }))} className="mt-1" /> <span>Acepto que {business.shortName} me contacte por esta consulta.</span></label>
                <label className="flex items-start gap-3"><input type="checkbox" required checked={form.privacyAcknowledged} onChange={(e) => setForm((p) => ({ ...p, privacyAcknowledged: e.target.checked }))} className="mt-1" /> <span>Entiendo que mis datos se usan solo para evaluar la financiación y que la simulación es estimativa.</span></label>
              </div>
            </FormSection>
            <MobileSummary>{summary}</MobileSummary>
            {error && <Notice tone="bad" role="alert">{error}</Notice>}
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={sending} className="sf-btn sf-btn-primary">{sending ? 'Enviando…' : 'Enviar solicitud'}</button>
              <WhatsAppButton label="Prefiero consultar por WhatsApp" message={`Hola ${business.shortName}, quiero consultar por financiación${vehicle ? ` para el ${vehicleTitle(vehicle)}` : ''}.`} className="sf-btn sf-btn-ghost" />
            </div>
          </form>
        </div>
      </RequestLayout>
    </>
  )
}
