'use client'

import { vehicleKind } from '@/features/lib/vehicleKinds'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { fetchGraphQL } from '@/features/storefront/lib/data/public-read'
import { Vehicle } from '@/features/storefront/lib/types'
import {
  addToComparison,
  getComparisonCount,
  isInComparison,
  removeFromComparison,
} from '@/features/storefront/lib/comparison'
import { reserveStorefrontVehicle, submitStorefrontInquiry, submitStorefrontTestDrive } from '../lib/submit'
import { Container } from '../components/Container'
import { LeadCaptureModal, LeadIntent, type LeadSubmissionFeedback } from '../components/LeadCaptureModal'
import { VehicleGallery } from '../components/vdp/VehicleGallery'
import { VehicleNotFound } from '../components/vdp/VehicleNotFound'
import { useStorefrontBusiness } from '../components/StorefrontBusinessProvider'
import { UsedReport } from '../components/UsedReport'
import { ShareButton } from '../components/ShareButton'
import { isLocalDemo } from '../lib/localStore'
import { PreviousPrice, isExpressOffer } from '../components/PreviousPrice'
import { formatMileage, formatPrice, vehicleTitle } from '../lib/format'
import { customerRequestReference } from '../lib/customerRequests'
import { parseVehicleFeatures, resolveVehicleDetail } from '../lib/data/vehicle-detail-response'
import { vehicleConditionLabel, vehicleStatus } from '../lib/vehicleStatus'
import { fuelLabel, transmissionLabel } from '@/features/lib/vehicleSpecs'
import { WhatsAppButton } from '../components/WhatsAppButton'

export type VehicleDetailPageState =
  | { id: string; status: 'loading' }
  | { id: string; status: 'error' }
  | { id: string; status: 'not-found' }
  | { id: string; status: 'available'; vehicle: Vehicle }
  | { id: string; status: 'unlisted'; vehicle: Vehicle }

const emptyFeedback: LeadSubmissionFeedback = { status: 'idle' }

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  message: '',
  preferredDate: '',
  preferredTime: '',
  website: '',
}

export function VehicleDetailPageClient({ id, initialState }: { id: string; initialState: VehicleDetailPageState }) {
  const business = useStorefrontBusiness()
  const [loadState, setLoadState] = useState<VehicleDetailPageState>(initialState)
  const [retryToken, setRetryToken] = useState(0)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [intent, setIntent] = useState<LeadIntent | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<LeadSubmissionFeedback>(emptyFeedback)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [formData, setFormData] = useState(emptyForm)
  const testDriveOpenerRef = useRef<HTMLButtonElement>(null)
  // The sticky mobile action bar only shows once the in-page actions have scrolled away,
  // so it never sits on top of "Schedule test drive" (as on Cars.com and CarMax).
  const actionsRef = useRef<HTMLDivElement>(null)
  const [actionsVisible, setActionsVisible] = useState(true)
  useEffect(() => {
    const node = actionsRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setActionsVisible(entry.isIntersecting), { rootMargin: '0px 0px -96px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const quoteOpenerRef = useRef<HTMLButtonElement>(null)
  const reserveOpenerRef = useRef<HTMLButtonElement>(null)
  const contactOpenerRef = useRef<HTMLButtonElement>(null)
  const barTestDriveOpenerRef = useRef<HTMLButtonElement>(null)
  const barContactOpenerRef = useRef<HTMLButtonElement>(null)
  const activeLeadOpenerRef = useRef<React.RefObject<HTMLButtonElement | null> | null>(null)
  const [compareCount, setCompareCount] = useState(0)
  const [comparing, setComparing] = useState(false)
  const [compareFull, setCompareFull] = useState(false)
  const [pageUrl, setPageUrl] = useState('')
  useEffect(() => { setPageUrl(window.location.href.split('#')[0]) }, [id])

  // The phone action bar floats above the shared compare bar when that bar is showing.
  useEffect(() => {
    const sync = () => {
      setCompareCount(getComparisonCount())
      setComparing(isInComparison(id))
    }
    sync()
    window.addEventListener('comparison-updated', sync)
    return () => window.removeEventListener('comparison-updated', sync)
  }, [id])

  // Muestra local: la ficha se lee del inventario local (con los cambios del panel) según la dirección.
  useEffect(() => {
    if (!isLocalDemo()) return
    let current = true
    const load = () => {
      const urlId = decodeURIComponent(window.location.hash.slice(1) || window.location.pathname.split('/').filter(Boolean).pop() || id)
      void resolveVehicleDetail(urlId, (query, variables) => fetchGraphQL<unknown>(query, variables)).then((result) => { if (current) { setLoadState({ ...result, id } as VehicleDetailPageState); setActiveImageIndex(0) } })
    }
    load()
    window.addEventListener('hashchange', load)
    return () => { current = false; window.removeEventListener('hashchange', load) }
  }, [id])

  useEffect(() => {
    if (retryToken === 0) return
    let isCurrentRequest = true
    setLoadState({ id, status: 'loading' })
    void resolveVehicleDetail(id, (query, variables) => fetchGraphQL<unknown>(query, variables))
      .then((result) => {
        if (isCurrentRequest) setLoadState(result)
      })
    return () => {
      isCurrentRequest = false
    }
  }, [id, retryToken])

  const vehicle = loadState.id === id && (loadState.status === 'available' || loadState.status === 'unlisted') ? loadState.vehicle : null
  // Pending or sold: the page stays up for shared links, read-only, with no request actions.
  const readOnly = loadState.id === id && loadState.status === 'unlisted'
  const loading = loadState.id !== id || loadState.status === 'loading'

  const retryVehicleLoad = () => {
    setLoadState({ id, status: 'loading' })
    setRetryToken((current) => current + 1)
  }

  const openLead = (type: LeadIntent, openerRef: React.RefObject<HTMLButtonElement | null>) => {
    activeLeadOpenerRef.current = openerRef
    setIntent(type)
    setFeedback(emptyFeedback)
    setIdempotencyKey(crypto.randomUUID())
    setFormData(emptyForm)
  }

  const closeLead = () => {
    if (isSubmitting) return
    const openerRef = activeLeadOpenerRef.current
    setIntent(null)
    setFeedback(emptyFeedback)
    setFormData(emptyForm)
    window.setTimeout(() => openerRef?.current?.focus(), 50)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vehicle || !intent || isSubmitting) return
    setIsSubmitting(true)
    setFeedback(emptyFeedback)
    try {
      if (intent === 'test-drive') {
        const result = await submitStorefrontTestDrive({
          customerName: `${formData.firstName} ${formData.lastName}`,
          customerEmail: formData.email,
          customerPhone: formData.phone,
          preferredDate: formData.preferredDate,
          preferredTime: formData.preferredTime,
          vehicleId: vehicle.id,
          message: formData.message,
          website: formData.website,
          rooftopSlug: business.rooftopSlug,
          idempotencyKey,
        })
        if (!result.success) throw new Error(result.error)
        setFeedback({
          status: 'success',
          message: `${business.fullName} recibió tu solicitud de prueba de manejo.`,
          reference: customerRequestReference('test-drive', result.data.testDriveId),
        })
      } else if (intent === 'reserve') {
        const result = await reserveStorefrontVehicle({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          message: formData.message,
          vehicleId: vehicle.id,
          website: formData.website,
          rooftopSlug: business.rooftopSlug,
          idempotencyKey,
        })
        if (!result.success) throw new Error(result.error)
        if (!result.data.checkoutUrl || !/^https:\/\//.test(result.data.checkoutUrl)) throw new Error('No pudimos iniciar el pago. Intenta de nuevo.')
        window.location.assign(result.data.checkoutUrl)
        return
      } else {
        const result = await submitStorefrontInquiry({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          preferredContact: 'email',
          intent: intent === 'get-quote' ? 'get-quote' : 'vehicle-question',
          message: intent === 'get-quote' ? ['Quiero comprar este vehículo de contado.', formData.message].filter(Boolean).join(' ') : formData.message,
          vehicleId: vehicle.id,
          website: formData.website,
          rooftopSlug: business.rooftopSlug,
          idempotencyKey,
        })
        if (!result.success) throw new Error(result.error)
        setFeedback({
          status: 'success',
          message: intent === 'get-quote'
            ? `${business.fullName} recibió tu pedido para comprarlo de contado. Te contactamos para coordinar.`
            : `${business.fullName} recibió tu consulta.`,
          reference: customerRequestReference('inquiry', result.data.leadId),
        })
      }
      setFormData(emptyForm)
    } catch (error) {
      setFeedback({
        status: 'error',
        message: error instanceof Error ? error.message : 'Algo salió mal. Intenta de nuevo.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return <VehicleDetailSkeleton />
  }

  if (loadState.id === id && loadState.status === 'error') {
    return (
      <Container className="py-[var(--sf-space-2xl)]">
        <div className="sf-well flex flex-col items-start gap-5 p-6 md:p-8">
          <div role="alert" aria-live="assertive">
            <h1 className="sf-title-line sf-heading text-[length:var(--sf-text-xl)]">
              <span className="sf-dot" data-tone="bad" aria-hidden="true" />
              No pudimos mostrar este vehículo
            </h1>
            <p className="sf-muted mt-2 pl-4">Ocurrió un error al cargar la publicación.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={retryVehicleLoad} className="sf-btn sf-btn-primary">
              Reintentar
            </button>
            <Link href="/inventory" className="sf-btn sf-btn-ghost">Volver al inventario</Link>
          </div>
        </div>
      </Container>
    )
  }

  if (loadState.id === id && loadState.status === 'not-found') {
    return <VehicleNotFound />
  }

  if (!vehicle) {
    return <VehicleDetailSkeleton />
  }

  const images = vehicle.images ?? []
  const features = parseVehicleFeatures(vehicle.features)
  const title = vehicleTitle(vehicle)
  const name = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
  const status = vehicleStatus(vehicle.status)
  const conditionLabel = vehicleConditionLabel(vehicle.condition)
  const hasPublicPrice = typeof vehicle.price === 'number' && Number.isFinite(vehicle.price) && vehicle.price >= 0
  const displayPrice = readOnly ? status.label : hasPublicPrice ? formatPrice(vehicle.price, business.currencyCode) : 'Consultar precio'
  const similarParams = new URLSearchParams()
  if (vehicle.make) similarParams.set('make', vehicle.make)
  if (vehicle.model) similarParams.set('model', vehicle.model)
  const similarHref = `/inventory${similarParams.size ? `?${similarParams.toString()}` : ''}`
  const financingHref = `/financing?vehicleId=${encodeURIComponent(vehicle.id)}${hasPublicPrice ? `&price=${encodeURIComponent(String(vehicle.price))}` : ''}`
  const tradeInHref = `/trade-in?vehicleId=${vehicle.id}`

  const toggleCompare = () => {
    if (comparing) {
      removeFromComparison(vehicle.id)
      setCompareFull(false)
      return
    }
    setCompareFull(!addToComparison(vehicle.id))
  }

  const specs: { label: string; value: string; figure?: boolean }[] = [
    { label: 'Año', value: String(vehicle.year ?? ''), figure: true },
    { label: 'Marca', value: vehicle.make || '' },
    { label: 'Modelo', value: vehicle.model || '' },
    { label: 'Versión', value: vehicle.trim || '' },
    { label: 'Kilometraje', value: formatMileage(vehicle.mileage), figure: true },
    { label: 'Combustible', value: fuelLabel(vehicle.fuelType) },
    { label: 'Transmisión', value: transmissionLabel(vehicle.transmission) },
    { label: 'Tipo de vehículo', value: vehicleKind(vehicle as Record<string, any>).carroceria },
    { label: 'Tracción', value: `${vehicleKind(vehicle as Record<string, any>).traccion} · ${vehicleKind(vehicle as Record<string, any>).tipoTraccion.toLowerCase()}` },
    { label: 'Cilindrada', value: vehicle.engine || '' },
    { label: 'Color', value: vehicle.color || '' },
  ]
  const whatsappMessage = [
    `Hola ${business.shortName}, quiero consultar por el ${[vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')} ${vehicle.year}`,
    hasPublicPrice && !readOnly ? `Precio publicado: ${formatPrice(vehicle.price, business.currencyCode)}` : '',
    pageUrl,
  ].filter(Boolean).join('\n')

  return (
    <>
      <nav aria-label="Ruta de navegación" className="border-b" style={{ borderColor: 'var(--sf-rule)' }}>
        <Container className="flex min-h-11 items-center gap-1.5 text-[length:var(--sf-text-sm)]">
          <Link href="/inventory" className="sf-muted inline-flex min-h-11 shrink-0 items-center gap-1 hover:text-[var(--sf-accent)]">
            <ChevronLeft className="size-4 sm:hidden" aria-hidden="true" />
            Inventario
          </Link>
          <ChevronRight className="sf-faint hidden size-3.5 shrink-0 sm:block" aria-hidden="true" />
          <span className="sf-faint hidden min-w-0 truncate sm:block" aria-current="page">{title}</span>
        </Container>
      </nav>

      <Container className="pb-[var(--sf-space-xl)] pt-4 md:pt-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-x-12 xl:gap-x-16">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <VehicleGallery
              images={images}
              activeIndex={activeImageIndex}
              onSelect={setActiveImageIndex}
              title={title}
              conditionLabel={conditionLabel}
              stockNumber={vehicle.stockNumber}
              make={vehicle.make}
              model={vehicle.model}
            />
          </div>

          <aside className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <p className="sf-eyebrow sf-eyebrow-accent flex items-center gap-2">
              <span className="sf-dot" data-tone={status.tone} aria-hidden="true" />
              {status.label}
            </p>
            <h1 className="mt-2 flex flex-wrap items-start gap-3">
              <span className="sf-display text-[2.25rem] leading-[0.9] xl:text-[2.75rem]" style={{ fontStretch: '100%', letterSpacing: '-0.015em' }}>{name}</span>
            </h1>
            <p className="sf-muted sf-caps mt-2 text-[length:var(--sf-text-md)]">
              {vehicle.trim}
            </p>

            <div className="mt-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-y py-4" style={{ borderColor: 'var(--sf-rule-strong)' }}>
              <p className="sf-price text-[2.375rem] md:text-[2.75rem]">{displayPrice}</p>
              {!readOnly && hasPublicPrice && isExpressOffer(vehicle) && (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[length:var(--sf-text-sm)]">
                  <span className="sf-chip" style={{ background: 'var(--sf-gold-gradient)', color: 'var(--sf-accent-ink)' }}>Oferta express</span>
                  <PreviousPrice previous={vehicle.previousPrice} price={vehicle.price} currencyCode={business.currencyCode} />
                </p>
              )}
              {vehicle.stockNumber && <span className="sf-stall text-[length:var(--sf-text-sm)]">#{vehicle.stockNumber}</span>}
            </div>

            {readOnly ? (
              <div className="mt-5">
                <Link href={similarHref} className="sf-btn sf-btn-primary sf-btn-block">
                  <Search className="size-4" aria-hidden="true" />
                  Ver vehículos similares
                </Link>
              </div>
            ) : (
              <div ref={actionsRef} className="mt-5 space-y-2">
                <WhatsAppButton label="Consultar por WhatsApp" message={whatsappMessage} className="sf-btn sf-btn-primary sf-btn-block" />
                <button
                  ref={testDriveOpenerRef}
                  type="button"
                  onClick={() => openLead('test-drive', testDriveOpenerRef)}
                  className="sf-btn sf-btn-outline sf-btn-block"
                >
                  Coordinar prueba de manejo
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    ref={quoteOpenerRef}
                    type="button"
                    onClick={() => openLead('get-quote', quoteOpenerRef)}
                    className="sf-btn sf-btn-ghost px-3"
                  >
                    Comprar de contado
                  </button>
                  {vehicle.status === 'reserved' ? (
                    <>
                      <Link href={similarHref} className="sf-btn sf-btn-ghost px-3">
                        Ver similares
                      </Link>
                      {/* The shopper whose unpaid checkout holds the car gets it back; anyone else is told it is taken. */}
                      <button
                        ref={reserveOpenerRef}
                        type="button"
                        onClick={() => openLead('reserve', reserveOpenerRef)}
                        className="sf-btn sf-btn-ghost col-span-2 px-3"
                      >
                        Completar mi reserva
                      </button>
                    </>
                  ) : (
                    <Link href={financingHref} className="sf-btn sf-btn-ghost px-3">
                      Simular financiación
                    </Link>
                  )}
                </div>
                <ShareButton title={title} text={`${title} — ${displayPrice} en ${business.shortName}`} className="sf-btn-block" />
                <div className="grid grid-cols-2 gap-2">
                <Link href={tradeInHref} className="sf-btn sf-btn-ghost px-3">Plan canje</Link>
                <button
                  type="button"
                  onClick={toggleCompare}
                  className={`sf-btn ${comparing ? 'sf-btn-secondary' : 'sf-btn-ghost'} px-3`}
                  aria-pressed={comparing}
                  aria-label={comparing ? `Quitar ${title} de la comparación` : `Agregar ${title} a la comparación`}
                >
                  {comparing ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                  Comparar
                </button>
                </div>
                {compareFull && <p role="status" className="sf-muted text-[length:var(--sf-text-xs)]">Puedes comparar hasta 4 vehículos.</p>}
                <div className="hidden flex-wrap gap-x-5 gap-y-1 pt-1 text-[length:var(--sf-text-sm)] lg:flex">
                  <button
                    ref={contactOpenerRef}
                    type="button"
                    onClick={() => openLead('contact', contactOpenerRef)}
                    className="sf-link min-h-10"
                  >
                    Hacer una consulta
                  </button>
                </div>
              </div>
            )}

            <div className="sf-sticker mt-6">
              <div className="sf-sticker-head">
                <span>Ficha técnica</span>
                <span>{status.label}</span>
              </div>
              <dl>
                <div className="sf-sticker-row">
                  <dt>Stock #</dt>
                  <dd>{vehicle.stockNumber}</dd>
                </div>
                <div className="sf-sticker-row">
                  <dt>Chasis (VIN)</dt>
                  <dd className="text-[length:var(--sf-text-xs)]">{vehicle.vin || 'No informado'}</dd>
                </div>
                <div className="sf-sticker-row">
                  <dt>Kilometraje</dt>
                  <dd>{formatMileage(vehicle.mileage)}</dd>
                </div>
                <div className="sf-sticker-row">
                  <dt>Estado</dt>
                  <dd>{conditionLabel}</dd>
                </div>
                <div className="sf-sticker-row">
                  <dt>Color</dt>
                  <dd>{vehicle.color || 'No informado'}</dd>
                </div>
                <div className="sf-sticker-row">
                  <dt>{readOnly ? 'Estado' : 'Precio'}</dt>
                  <dd className="font-semibold">{displayPrice}</dd>
                </div>
              </dl>
            </div>
          </aside>

          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <section aria-labelledby="vdp-spec">
              <h2 id="vdp-spec" className="sf-caps text-[0.875rem] font-medium">Especificaciones</h2>
              <dl className="sf-spec mt-4 grid-cols-2 sm:grid-cols-3">
                {specs.map((spec) => (
                  <div key={spec.label}>
                    <dt>{spec.label}</dt>
                    <dd className={spec.figure ? 'sf-figure' : undefined}>{spec.value || 'No informado'}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <UsedReport report={vehicle.usedReport} />

            <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--sf-rule)' }} aria-labelledby="vdp-description">
              <h2 id="vdp-description" className="sf-caps text-[0.875rem] font-medium">Descripción</h2>
              {vehicle.description ? (
                <p className="sf-muted mt-4 max-w-[68ch] whitespace-pre-line text-[length:var(--sf-text-md)] leading-relaxed">
                  {vehicle.description}
                </p>
              ) : (
                <p className="sf-faint mt-4 text-[length:var(--sf-text-sm)]">Sin descripción.</p>
              )}
            </section>

            {Array.isArray(features) && features.length > 0 && (
              <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--sf-rule)' }} aria-labelledby="vdp-features">
                <h2 id="vdp-features" className="sf-title-line sf-caps text-[0.875rem] font-medium">
                  Equipamiento
                  <span className="sf-chip sf-figure">{features.length}</span>
                </h2>
                <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
                  {features.map((feature: unknown, index: number) => {
                    const name =
                      typeof feature === 'string' ? feature : (feature as { name?: string })?.name ?? 'Equipamiento'
                    return (
                      <li
                        key={index}
                        className="flex items-start gap-3 border-b py-3 text-[length:var(--sf-text-sm)]"
                        style={{ borderColor: 'var(--sf-rule)' }}
                      >
                        <Check className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--sf-accent)' }} aria-hidden="true" />
                        <span className="min-w-0">{name}</span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </div>
        </div>

        {!readOnly && <div className={compareCount > 0 ? 'h-40 lg:hidden' : 'h-20 lg:hidden'} aria-hidden="true" />}
      </Container>

      {!readOnly && (
      <div
        className={`fixed inset-x-3 z-40 transition-[opacity,transform] duration-200 lg:hidden ${compareCount > 0 ? 'bottom-[7.25rem] md:bottom-[5.25rem]' : 'bottom-12'} ${actionsVisible ? 'pointer-events-none translate-y-4 opacity-0' : 'opacity-100'}`}
        role="region"
        aria-label="Acciones del vehículo"
        aria-hidden={actionsVisible || undefined}
        inert={actionsVisible || undefined}
      >
        <div
          className={`mx-auto grid max-w-md gap-1.5 ${business.whatsappNumber ? 'grid-cols-[auto_1fr_1fr_1fr]' : 'grid-cols-4'} rounded-[var(--sf-radius-md)] border p-1.5`}
          style={{ background: 'var(--sf-paper)', borderColor: 'var(--sf-rule)', boxShadow: 'var(--sf-shadow-float)' }}
        >
          {business.whatsappNumber ? (
            <WhatsAppButton iconOnly label="Consultar este vehículo por WhatsApp" message={whatsappMessage} className="sf-btn sf-btn-ghost sf-bar-btn min-w-0 px-3 text-[var(--sf-accent)]" />
          ) : (
            <button
              ref={barContactOpenerRef}
              type="button"
              onClick={() => openLead('contact', barContactOpenerRef)}
              className="sf-btn sf-btn-ghost sf-bar-btn min-w-0 px-1"
            >
              Consultar
            </button>
          )}
          <button
            ref={barTestDriveOpenerRef}
            type="button"
            onClick={() => openLead('test-drive', barTestDriveOpenerRef)}
            className="sf-btn sf-btn-primary sf-bar-btn min-w-0 px-1"
          >
            Prueba
          </button>
          <Link href={financingHref} className="sf-btn sf-btn-ghost sf-bar-btn min-w-0 px-1">Financiar</Link>
          <Link href={tradeInHref} className="sf-btn sf-btn-ghost sf-bar-btn min-w-0 px-1">Plan canje</Link>
        </div>
      </div>
      )}

      {intent && !readOnly && (
        <LeadCaptureModal
          vehicle={vehicle}
          intent={intent}
          onClose={closeLead}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          feedback={feedback}
          formData={formData}
          setFormData={setFormData}
          returnFocusTo={activeLeadOpenerRef.current?.current || null}
        />
      )}
    </>
  )
}

function VehicleDetailSkeleton() {
  return (
    <Container className="pb-[var(--sf-space-xl)] pt-[3.75rem] md:pt-[5.25rem]">
      <div
        className="grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-x-12 xl:gap-x-16"
        aria-busy="true"
        aria-label="Cargando vehículo"
      >
        <div className="min-w-0">
          <div className="sf-skeleton aspect-[4/3] sm:aspect-[16/10]" />
          <div className="mt-3 flex gap-2 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="sf-skeleton aspect-[4/3] w-20 shrink-0 sm:w-24" />
            ))}
          </div>
        </div>
        <div className="min-w-0" aria-hidden="true">
          <div className="sf-skeleton h-9 w-4/5" />
          <div className="sf-skeleton mt-3 h-5 w-1/3" />
          <div className="sf-skeleton mt-5 h-16 w-full" />
          <div className="sf-skeleton mt-5 h-11 w-full" />
          <div className="sf-skeleton mt-6 h-64 w-full" />
        </div>
      </div>
    </Container>
  )
}
