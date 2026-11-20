'use client'

import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Link2, Pencil, RefreshCw, Truck, Unlink } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Attention, Code, DeskHeader, DeskSection, Facts, Figure, Notice, Panel, Pill, Status, TitleLine, Track } from '@/features/platform/components/desk'
import { formatPhone } from '@/features/platform/lib/format'
import { MoneyInput } from '@/features/platform/deals/components/MoneyInput'
import { labelForDeal, toneForDeal } from '@/features/platform/deals/lib/dealStatus'
import {
  acquireTradeIn,
  getPencilDealsForTradeIn,
  getTradeIn,
  recordTradeInAppraisal,
  setDealTradeIn,
  updateTradeInDetails,
  type PencilDealOption,
  type TradeIn,
  type TradeInAcquisition,
  type TradeInTimelineEntry,
} from '../actions'
import { TradeInFormDialog, tradeInDetailsPayload, type TradeInFormValues } from '../components/TradeInFormDialog'
import {
  conditionLabel,
  conditionNotes,
  conditionTone,
  formatMileage,
  formatWholeUsd,
  preliminaryWholesaleEstimate,
  tradeInCustomer,
  tradeInState,
  tradeInActions,
  tradeInClosedReason,
  tradeInReference,
  tradeInVehicleLabel,
  VIN_PATTERN,
} from '../lib/tradeInState'

type DetailData = { tradeIn: TradeIn | null; acquisition: TradeInAcquisition | null; canSeeAcquisitions: boolean; timeline: TradeInTimelineEntry[] }
type DialogKind = 'edit' | 'appraise' | 'attach' | 'detach' | 'acquire' | null

const fieldLabel = 'text-[12px] font-medium text-muted-foreground'

const timelineLabel: Record<string, string> = {
  created: 'Creado',
  submitted: 'Enviado por la web',
  appraised: 'Tasado',
  'attached-to-deal': 'Vinculado a la operación',
  'detached-from-deal': 'Desvinculado de la operación',
  'released-from-deal': 'Liberado por operación cancelada',
}

function FieldRow({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1.5 text-sm">
      <label htmlFor={htmlFor} className={fieldLabel}>{label}</label>
      {children}
      {error && <p id={`${htmlFor}-error`} className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

function ActionDialog({ open, title, description, busy, error, submitLabel, onSubmit, onOpenChange, children }: {
  open: boolean
  title: string
  description?: string
  busy: boolean
  error: string | null
  submitLabel: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value) }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {children}
          {error && <Notice tone="bad">{error}</Notice>}
          <DialogFooter className="sm:justify-end">
            <Track>
              <Pill variant="plain" disabled={busy} onClick={() => onOpenChange(false)}>Cancelar</Pill>
              <Pill type="submit" variant="primary" disabled={busy}>{busy ? 'Guardando…' : submitLabel}</Pill>
            </Track>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function dealLabel(deal: { vehicle: { year: number | null; make: string | null; model: string | null; stockNumber?: string | null } | null }) {
  return deal.vehicle ? [deal.vehicle.year, deal.vehicle.make, deal.vehicle.model].filter(Boolean).join(' ') : 'Operación'
}

export function TradeInDetailPageClient({
  id,
  initialData,
  initialError,
  timeZone,
}: {
  id: string
  initialData: DetailData | null
  initialError: string | null
  timeZone: string
}) {
  const [data, setData] = useState<DetailData | null>(initialData)
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const commandKeyRef = useRef('')

  // Appraisal
  const [referenceCents, setReferenceCents] = useState(0)
  const [offerCents, setOfferCents] = useState(0)
  // Attach / detach
  const [pencilDeals, setPencilDeals] = useState<PencilDealOption[] | null>(null)
  const [dealId, setDealId] = useState('')
  const [reason, setReason] = useState('')
  // Acquire
  const [acquire, setAcquire] = useState({ vin: '', year: '', make: '', model: '', odometer: '', appraisalCents: 0, reconEstimateCents: 0, reason: '' })

  const tradeIn = data?.tradeIn ?? null
  const acquisition = data?.acquisition ?? null

  const load = async () => {
    setLoading(true)
    const response = await getTradeIn(id)
    if (response.success) {
      setData(response.data)
      setError(null)
    } else {
      setError(response.error || 'No se pudo cargar el usado.')
    }
    setLoading(false)
  }

  const openDialog = async (kind: Exclude<DialogKind, null>) => {
    if (!tradeIn) return
    setDialogError(null)
    setShowErrors(false)
    setNotice(null)
    commandKeyRef.current = `trade-in:${kind}:${tradeIn.id}:${crypto.randomUUID()}`
    if (kind === 'appraise') {
      setReferenceCents(Math.round((tradeIn.referenceValue || 0) * 100))
      setOfferCents(Math.round((tradeIn.offerAmount || 0) * 100))
    }
    if (kind === 'attach' || kind === 'detach') {
      setDealId('')
      setReason('')
    }
    if (kind === 'acquire') {
      setAcquire({
        vin: tradeIn.vin || '',
        year: tradeIn.year || '',
        make: tradeIn.make || '',
        model: tradeIn.model || '',
        odometer: tradeIn.mileage == null ? '' : String(tradeIn.mileage),
        appraisalCents: Math.round((tradeIn.offerAmount || 0) * 100),
        reconEstimateCents: 0,
        reason: '',
      })
    }
    setDialog(kind)
    if (kind === 'attach') {
      setPencilDeals(null)
      const response = await getPencilDealsForTradeIn()
      if (response.success) setPencilDeals(response.data.deals || [])
      else {
        setPencilDeals([])
        setDialogError(response.error || 'No se pudieron cargar las operaciones borrador.')
      }
    }
  }

  const closeDialog = (open: boolean) => {
    if (open) return
    setDialog(null)
    setDialogError(null)
  }

  const finish = async (message: string) => {
    setDialog(null)
    setNotice(message)
    await load()
  }

  const submitEdit = async (values: TradeInFormValues) => {
    if (!tradeIn) return
    setBusy(true)
    setDialogError(null)
    const response = await updateTradeInDetails(tradeIn.id, tradeInDetailsPayload(values))
    setBusy(false)
    if (!response.success) return setDialogError(response.error || 'No se pudo guardar el usado.')
    await finish('Trade-in updated')
  }

  const offerError = offerCents <= 0 ? 'Ingresa la oferta' : null

  const submitAppraisal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!tradeIn) return
    setShowErrors(true)
    if (offerError) return
    setBusy(true)
    setDialogError(null)
    const response = await recordTradeInAppraisal({ id: tradeIn.id, referenceValueCents: referenceCents, offerAmountCents: offerCents, idempotencyKey: commandKeyRef.current })
    setBusy(false)
    if (!response.success) return setDialogError(response.error)
    await finish('Appraisal recorded')
  }

  const eligibleDeals = (pencilDeals || []).filter(deal =>
    deal.rooftop?.id === tradeIn?.rooftop?.id && (!tradeIn?.lead || !deal.lead || deal.lead.id === tradeIn.lead.id)
  )
  const selectedDeal = eligibleDeals.find(deal => deal.id === dealId)

  const submitAttach = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!tradeIn) return
    setShowErrors(true)
    if (!selectedDeal) return
    setBusy(true)
    setDialogError(null)
    const response = await setDealTradeIn({ dealId: selectedDeal.id, tradeInId: tradeIn.id, expectedUpdatedAt: selectedDeal.updatedAt, reason: reason.trim() || undefined, idempotencyKey: commandKeyRef.current })
    setBusy(false)
    if (!response.success) return setDialogError(response.error)
    await finish('Attached to the deal; trade credit repriced')
  }

  const submitDetach = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!tradeIn?.deal?.updatedAt) return
    setShowErrors(true)
    if (!reason.trim()) return
    setBusy(true)
    setDialogError(null)
    const response = await setDealTradeIn({ dealId: tradeIn.deal.id, tradeInId: null, expectedUpdatedAt: tradeIn.deal.updatedAt, reason: reason.trim(), idempotencyKey: commandKeyRef.current })
    setBusy(false)
    if (!response.success) return setDialogError(response.error)
    await finish('Detached from the deal; trade credit removed')
  }

  const acquireErrors = {
    vin: VIN_PATTERN.test(acquire.vin.trim().toUpperCase()) ? null : 'Ingresa el número de chasis de 17 caracteres',
    year: /^\d{4}$/.test(acquire.year.trim()) ? null : 'Ingresa un año de 4 dígitos',
    make: acquire.make.trim() ? null : 'La marca es obligatoria',
    model: acquire.model.trim() ? null : 'El modelo es obligatorio',
    odometer: !acquire.odometer.trim() || /^\d+$/.test(acquire.odometer.trim().replace(/,/g, '')) ? null : 'Ingresa kilómetros enteros',
    appraisalCents: acquire.appraisalCents > 0 ? null : 'Ingresa la tasación',
    reason: acquire.reason.trim() ? null : 'El motivo es obligatorio',
  }

  const submitAcquire = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!tradeIn?.rooftop?.id) return
    setShowErrors(true)
    if (Object.values(acquireErrors).some(Boolean)) return
    setBusy(true)
    setDialogError(null)
    const odometer = acquire.odometer.trim().replace(/,/g, '')
    const response = await acquireTradeIn({
      tradeInId: tradeIn.id,
      rooftopId: tradeIn.rooftop.id,
      vin: acquire.vin.trim().toUpperCase(),
      year: Number(acquire.year),
      make: acquire.make.trim(),
      model: acquire.model.trim(),
      odometer: odometer ? Number(odometer) : null,
      appraisalCents: acquire.appraisalCents,
      reconEstimateCents: acquire.reconEstimateCents || null,
      reason: acquire.reason.trim(),
    })
    setBusy(false)
    if (!response.success) return setDialogError(response.error)
    await finish(`Acquisition ${response.data.startInventoryAcquisition?.reference || ''} started`.replace('  ', ' '))
  }

  const breadcrumbs = (label: string) => [
    { type: 'link' as const, label: 'Inicio', href: basePath },
    { type: 'page' as const, label: 'Gestión' },
    { type: 'link' as const, label: 'Usados ofrecidos', href: `${basePath}/platform/trade-ins` },
    { type: 'page' as const, label },
  ]

  if (!tradeIn) {
    return (
      <PageContainer
        title="Usado"
        breadcrumbs={breadcrumbs('Usado')}
        header={<DeskHeader title="Usado no disponible" tone="bad" status="No disponible" actions={<Pill asChild className="max-md:h-10"><Link href={`${basePath}/platform/trade-ins`}>Volver a usados</Link></Pill>} />}
      >
        <div className="space-y-3 px-4 pb-24 md:px-6">
          <Notice tone="bad">{error || 'Trade-in not found'}</Notice>
          <Track><Pill size="sm" onClick={load} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : undefined} />Reintentar</Pill></Track>
        </div>
      </PageContainer>
    )
  }

  const state = tradeInState(tradeIn, acquisition)
  const title = tradeInVehicleLabel(tradeIn)
  const customer = tradeInCustomer(tradeIn)
  const deal = tradeIn.deal
  const dealIsPencil = deal?.status === 'pencil'
  const estimate = preliminaryWholesaleEstimate(tradeIn.referenceValue || 0, tradeIn.condition, tradeIn.mileage)
  const spread = tradeIn.referenceValue != null && tradeIn.offerAmount != null ? tradeIn.referenceValue - tradeIn.offerAmount : null

  const appraiseBlocked = deal ? 'Desvincula de la operación para volver a tasar' : null
  const attachBlocked = tradeIn.offerAmount == null ? 'Primero registra una oferta' : null
  const detachBlocked = deal && !dealIsPencil ? `The deal is ${labelForDeal(deal.status || '').toLowerCase()}` : null
  const editBlocked = deal && !dealIsPencil ? `On a ${labelForDeal(deal.status || '').toLowerCase()} deal` : null
  const allowed = tradeInActions(tradeIn, acquisition)
  const closed = allowed.closed
  const blockers = closed ? [] : [
    appraiseBlocked && `Appraise: ${appraiseBlocked}`,
    !deal && attachBlocked && `Attach: ${attachBlocked}`,
    detachBlocked && `Detach: ${detachBlocked}`,
    editBlocked && `Edit: ${editBlocked}`,
  ].filter(Boolean) as string[]

  const primary = closed ? null : tradeIn.offerAmount == null ? 'appraise' : !deal ? 'attach' : !acquisition && data?.canSeeAcquisitions ? 'acquire' : null

  const actions = (
    <div role="group" aria-label="Acciones del usado" className="flex flex-wrap items-center gap-2 max-md:[&>button]:h-10">
      {allowed.appraise && (
        <Pill variant={primary === 'appraise' ? 'primary' : 'raised'} onClick={() => openDialog('appraise')} disabled={Boolean(appraiseBlocked)} aria-describedby={appraiseBlocked ? 'trade-in-blockers' : undefined}>
          {tradeIn.offerAmount == null ? 'Tasar' : 'Volver a tasar'}
        </Pill>
      )}
      {closed ? null : deal ? (
        <Pill onClick={() => openDialog('detach')} disabled={Boolean(detachBlocked)} aria-describedby={detachBlocked ? 'trade-in-blockers' : undefined}>
          <Unlink />
          Desvincular
        </Pill>
      ) : (
        <Pill variant={primary === 'attach' ? 'primary' : 'raised'} onClick={() => openDialog('attach')} disabled={Boolean(attachBlocked)} aria-describedby={attachBlocked ? 'trade-in-blockers' : undefined}>
          <Link2 />
          Vincular a operación
        </Pill>
      )}
      {data?.canSeeAcquisitions && allowed.acquire && (
        <Pill variant={primary === 'acquire' ? 'primary' : 'raised'} onClick={() => openDialog('acquire')}>
          <Truck />
          Ingresar al inventario
        </Pill>
      )}
      {!closed && (
        <Pill onClick={() => openDialog('edit')} disabled={Boolean(editBlocked)} aria-describedby={editBlocked ? 'trade-in-blockers' : undefined}>
          <Pencil />
          Editar
        </Pill>
      )}
    </div>
  )

  const header = (
    <DeskHeader
      title={title}
      tone={state.tone}
      status={state.label}
      meta={
        <span className="flex flex-wrap gap-x-2">
          <span className="text-foreground">{state.label}</span>
          <span>· Trade-in <Code>{tradeInReference(tradeIn)}</Code></span>
          <span>· {customer || 'No customer'}</span>
          {tradeIn.rooftop?.name && <span>· {tradeIn.rooftop.name}</span>}
        </span>
      }
      actions={closed ? undefined : actions}
    />
  )

  const editInitial: TradeInFormValues = {
    rooftopId: tradeIn.rooftop?.id || '',
    leadId: tradeIn.lead?.id || '',
    vin: tradeIn.vin || '',
    year: tradeIn.year || '',
    make: tradeIn.make || '',
    model: tradeIn.model || '',
    trim: tradeIn.trim || '',
    mileage: tradeIn.mileage == null ? '' : String(tradeIn.mileage),
    condition: tradeIn.condition || '',
    exteriorCondition: tradeIn.exteriorCondition || '',
    interiorCondition: tradeIn.interiorCondition || '',
    mechanicalIssues: tradeIn.mechanicalIssues || '',
  }

  const formatDateTime = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleString('es-AR', { timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-'

  return (
    <PageContainer title={title} header={header} breadcrumbs={breadcrumbs(title)}>
      <div className="min-w-0 max-w-full space-y-8 px-4 pb-24 md:px-6">
        {(notice || error || closed || blockers.length > 0) && (
          <div className="space-y-2">
            {notice && <Notice tone="ok">{notice}</Notice>}
            {error && <Notice tone="bad">{error}</Notice>}
            {closed && (
              <Notice tone="idle">Closed: {tradeInClosedReason(tradeIn)}</Notice>
            )}
            {blockers.length > 0 && <p id="trade-in-blockers" className="text-xs text-muted-foreground">{blockers.join(' · ')}</p>}
          </div>
        )}


        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-8">
            <DeskSection title="Tasación" id="trade-in-appraisal">
              <div className="flex min-w-0 flex-wrap items-end gap-x-6 gap-y-2 pb-3">
                <div>
                  <p className="text-[12px] font-medium text-muted-foreground">Oferta</p>
                  <p className="mt-1">
                    {tradeIn.offerAmount != null ? <Figure size="lg">{formatWholeUsd(tradeIn.offerAmount)}</Figure> : closed ? <span className="text-sm text-muted-foreground">Sin oferta</span> : <Attention>Requiere tasación</Attention>}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">{tradeIn.appraisedBy?.name ? `By ${tradeIn.appraisedBy.name}` : 'Sin tasar'}</p>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-x-8 md:grid-cols-2">
                <Facts items={[
                  { label: 'Referencia', value: tradeIn.referenceValue != null ? formatWholeUsd(tradeIn.referenceValue) : '-' },
                  { label: 'Estimación', value: formatWholeUsd(estimate) },
                ]} />
                <Facts items={[
                  { label: 'Diferencia', value: spread != null ? <span className={spread < 0 ? 'text-red-700 dark:text-red-300' : undefined}>{formatWholeUsd(spread)}{spread < 0 ? ' · offer above reference' : ''}</span> : '-' },
                  { label: 'Estado', value: tradeIn.condition ? <Status tone={conditionTone[tradeIn.condition] ?? 'idle'}>{conditionLabel(tradeIn.condition)}</Status> : 'Sin calificar' },
                ]} />
              </div>
            </DeskSection>

            <DeskSection title="Vehículo">
              <Facts items={[
                { label: 'Vehículo', value: title },
                { label: 'VIN / chasis', value: <Code className="break-all text-foreground">{tradeIn.vin || 'Not entered'}</Code> },
                { label: 'Kilometraje', value: <span className="tabular-nums">{formatMileage(tradeIn.mileage)}</span> },
                { label: 'Estado', value: conditionLabel(tradeIn.condition) },
                { label: 'Creado', value: formatDateTime(tradeIn.createdAt) },
              ]} />
            </DeskSection>

            <DeskSection title="Fotos enviadas por el cliente" count={tradeIn.photos?.length ?? 0}>
              {tradeIn.photos?.some((photo) => photo.image?.url) ? (
                <ul className="grid grid-cols-2 gap-2 py-2 sm:grid-cols-4">
                  {tradeIn.photos.filter((photo) => photo.image?.url).map((photo, index) => (
                    <li key={photo.id}>
                      <a href={photo.image!.url!} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md border bg-muted" aria-label={`Abrir foto ${index + 1} en tamaño completo`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.image!.url!} alt={`Foto ${index + 1} del usado`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-2 text-sm text-muted-foreground">El cliente no envió fotos.</p>
              )}
            </DeskSection>

            <DeskSection title="Notas del estado">
              {tradeIn.exteriorCondition || tradeIn.interiorCondition || tradeIn.mechanicalIssues ? (
                <Facts items={[
                  tradeIn.exteriorCondition ? { label: 'Exterior', value: <span className="whitespace-pre-wrap text-left">{tradeIn.exteriorCondition}</span> } : null,
                  tradeIn.interiorCondition ? { label: 'Interior', value: <span className="whitespace-pre-wrap text-left">{conditionNotes(tradeIn.interiorCondition)}</span> } : null,
                  tradeIn.mechanicalIssues ? { label: 'Mecánica', value: <span className="whitespace-pre-wrap text-left text-amber-700 dark:text-amber-300">{tradeIn.mechanicalIssues}</span> } : null,
                ]} />
              ) : (
                <p className="py-2 text-sm text-muted-foreground">Sin notas</p>
              )}
            </DeskSection>

            <DeskSection title="Historial" count={data?.timeline.length}>
              {data?.timeline.length ? (
                <Panel className="divide-y">
                  {data.timeline.map(entry => (
                    <div key={entry.id} className="flex min-w-0 items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
                      <span className="min-w-0 break-words">{timelineLabel[entry.action] ?? entry.action}{entry.actor?.name ? ` · ${entry.actor.name}` : ''}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDateTime(entry.occurredAt)}</span>
                    </div>
                  ))}
                </Panel>
              ) : (
                <p className="py-2 text-sm text-muted-foreground">Sin historial</p>
              )}
            </DeskSection>
          </div>

          <aside className="min-w-0 space-y-8 lg:sticky lg:top-6 lg:self-start">
            <DeskSection title="Cliente" actions={tradeIn.lead ? <Link href={`${basePath}/platform/crm/${tradeIn.lead.id}`} className="text-xs font-medium text-muted-foreground hover:text-foreground">Abrir consulta</Link> : undefined}>
              {tradeIn.lead ? (
                <Facts items={[
                  { label: 'Nombre', value: customer },
                  { label: 'Teléfono', value: formatPhone(tradeIn.lead.phone) || '-' },
                  { label: 'Email', value: <span className="break-all">{tradeIn.lead.email || '-'}</span> },
                ]} />
              ) : (
                <p className="py-2 text-sm text-muted-foreground">Sin consulta del cliente</p>
              )}
            </DeskSection>

            <DeskSection title="Operación" actions={deal ? <Link href={`${basePath}/platform/deals/${deal.id}`} className="text-xs font-medium text-muted-foreground hover:text-foreground">Abrir operación</Link> : undefined}>
              {deal ? (
                <div className="space-y-2">
                  <TitleLine as="p" tone={toneForDeal(deal.status || '')} status={labelForDeal(deal.status || '')} className="text-sm font-medium">{dealLabel(deal)}</TitleLine>
                  <Facts items={[
                    { label: 'Estado', value: labelForDeal(deal.status || '') },
                    deal.vehicle?.stockNumber ? { label: 'Stock #', value: <Code className="text-foreground">{deal.vehicle.stockNumber}</Code> } : null,
                    { label: 'Valor de toma', value: formatWholeUsd((deal.tradeInValueCents || 0) / 100) },
                  ]} />
                </div>
              ) : (
                <p className="py-2 text-sm text-muted-foreground">Sin operación</p>
              )}
            </DeskSection>

            {data?.canSeeAcquisitions && (
              <DeskSection title="Ingreso al inventario" actions={acquisition ? <Link href={`${basePath}/platform/vehicles`} className="text-xs font-medium text-muted-foreground hover:text-foreground">Abrir inventario</Link> : undefined}>
                {acquisition ? (
                  <Facts items={[
                    { label: 'Referencia', value: <Code className="text-foreground">{acquisition.reference}</Code> },
                    { label: 'Estado', value: <span className="capitalize">{acquisition.status.replace(/-/g, ' ')}</span> },
                    { label: 'Stock #', value: acquisition.vehicle?.stockNumber ? <Code className="text-foreground">{acquisition.vehicle.stockNumber}</Code> : 'Sin ingresar' },
                  ]} />
                ) : (
                  <p className="py-2 text-sm text-muted-foreground">Sin ingresar</p>
                )}
              </DeskSection>
            )}
          </aside>
        </div>
      </div>

      <TradeInFormDialog open={dialog === 'edit'} mode="edit" initialValues={editInitial} busy={busy} error={dialogError} onSubmit={submitEdit} onOpenChange={closeDialog} />

      <ActionDialog open={dialog === 'appraise'} title="Registrar tasación" description={title} busy={busy} error={dialogError} submitLabel="Guardar tasación" onSubmit={submitAppraisal} onOpenChange={closeDialog}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Valor de referencia" htmlFor="appraisal-reference">
            <MoneyInput id="appraisal-reference" cents={referenceCents} onCentsChange={setReferenceCents} disabled={busy} />
          </FieldRow>
          <FieldRow label="Oferta" htmlFor="appraisal-offer" error={showErrors ? offerError : null}>
            <MoneyInput id="appraisal-offer" cents={offerCents} onCentsChange={setOfferCents} disabled={busy} aria-invalid={showErrors && offerError ? true : undefined} aria-describedby={showErrors && offerError ? 'appraisal-offer-error' : undefined} />
          </FieldRow>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">Estimate {formatWholeUsd(preliminaryWholesaleEstimate(referenceCents / 100, tradeIn.condition, tradeIn.mileage))} · Spread {formatWholeUsd((referenceCents - offerCents) / 100)}</span>
          <Track>
            <Pill size="sm" disabled={busy || referenceCents <= 0} onClick={() => setOfferCents(preliminaryWholesaleEstimate(referenceCents / 100, tradeIn.condition, tradeIn.mileage) * 100)}>Usar estimación</Pill>
          </Track>
        </div>
      </ActionDialog>

      <ActionDialog open={dialog === 'attach'} title="Vincular a operación" description={`La oferta de ${formatWholeUsd(tradeIn.offerAmount)} pasa a ser el valor de toma`} busy={busy} error={dialogError} submitLabel="Vincular" onSubmit={submitAttach} onOpenChange={closeDialog}>
        <FieldRow label="Operación borrador" htmlFor="attach-deal" error={showErrors && !selectedDeal ? 'Elige una operación' : null}>
          <Select value={dealId} onValueChange={setDealId} disabled={busy || pencilDeals === null || eligibleDeals.length === 0}>
            <SelectTrigger id="attach-deal" className="rounded-[4px]" aria-invalid={showErrors && !selectedDeal ? true : undefined}>
              <SelectValue placeholder={pencilDeals === null ? 'Loading deals' : eligibleDeals.length === 0 ? 'No hay operaciones borrador sin usado' : 'Elige la operación'} />
            </SelectTrigger>
            <SelectContent>
              {eligibleDeals.map(option => (
                <SelectItem key={option.id} value={option.id}>
                  {dealLabel(option)}{option.vehicle?.stockNumber ? ` · #${option.vehicle.stockNumber}` : ''}{option.lead ? ` · ${[option.lead.firstName, option.lead.lastName].filter(Boolean).join(' ')}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        {selectedDeal && (
          <Facts items={[
            { label: 'Valor de toma actual', value: formatWholeUsd((selectedDeal.tradeInValueCents || 0) / 100) },
            { label: 'Nuevo valor de toma', value: formatWholeUsd(tradeIn.offerAmount) },
          ]} />
        )}
        <FieldRow label="Nota (opcional)" htmlFor="attach-reason">
          <Textarea className="rounded-[4px]" id="attach-reason" rows={2} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} />
        </FieldRow>
        {pencilDeals !== null && (
          <Link href={`${basePath}/platform/deals/create${tradeIn.lead ? `?leadId=${tradeIn.lead.id}` : ''}`} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            Nueva operación
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </ActionDialog>

      <ActionDialog open={dialog === 'detach'} title="Desvincular de la operación" description={deal ? `${dealLabel(deal)} · el crédito por el usado vuelve a $0` : undefined} busy={busy} error={dialogError} submitLabel="Desvincular" onSubmit={submitDetach} onOpenChange={closeDialog}>
        <FieldRow label="Motivo" htmlFor="detach-reason" error={showErrors && !reason.trim() ? 'El motivo es obligatorio' : null}>
          <Textarea className="rounded-[4px]" id="detach-reason" rows={2} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} aria-invalid={showErrors && !reason.trim() ? true : undefined} />
        </FieldRow>
      </ActionDialog>

      <ActionDialog open={dialog === 'acquire'} title="Ingresar al inventario" description="Origen: toma de usado" busy={busy} error={dialogError} submitLabel="Iniciar ingreso" onSubmit={submitAcquire} onOpenChange={closeDialog}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldRow label="VIN / chasis" htmlFor="acquire-vin" error={showErrors ? acquireErrors.vin : null}>
              <Input id="acquire-vin" maxLength={17} className="rounded-[4px] font-mono uppercase" value={acquire.vin} onChange={event => setAcquire(current => ({ ...current, vin: event.target.value }))} disabled={busy} aria-invalid={showErrors && acquireErrors.vin ? true : undefined} />
            </FieldRow>
          </div>
          <FieldRow label="Año" htmlFor="acquire-year" error={showErrors ? acquireErrors.year : null}>
            <Input className="rounded-[4px]" id="acquire-year" inputMode="numeric" maxLength={4} value={acquire.year} onChange={event => setAcquire(current => ({ ...current, year: event.target.value }))} disabled={busy} />
          </FieldRow>
          <FieldRow label="Kilometraje" htmlFor="acquire-odometer" error={showErrors ? acquireErrors.odometer : null}>
            <Input className="rounded-[4px]" id="acquire-odometer" inputMode="numeric" value={acquire.odometer} onChange={event => setAcquire(current => ({ ...current, odometer: event.target.value }))} disabled={busy} />
          </FieldRow>
          <FieldRow label="Marca" htmlFor="acquire-make" error={showErrors ? acquireErrors.make : null}>
            <Input className="rounded-[4px]" id="acquire-make" value={acquire.make} onChange={event => setAcquire(current => ({ ...current, make: event.target.value }))} disabled={busy} />
          </FieldRow>
          <FieldRow label="Modelo" htmlFor="acquire-model" error={showErrors ? acquireErrors.model : null}>
            <Input className="rounded-[4px]" id="acquire-model" value={acquire.model} onChange={event => setAcquire(current => ({ ...current, model: event.target.value }))} disabled={busy} />
          </FieldRow>
          <FieldRow label="Tasación" htmlFor="acquire-appraisal" error={showErrors ? acquireErrors.appraisalCents : null}>
            <MoneyInput id="acquire-appraisal" cents={acquire.appraisalCents} onCentsChange={cents => setAcquire(current => ({ ...current, appraisalCents: cents }))} disabled={busy} />
          </FieldRow>
          <FieldRow label="Presupuesto de preparación" htmlFor="acquire-recon">
            <MoneyInput id="acquire-recon" cents={acquire.reconEstimateCents} onCentsChange={cents => setAcquire(current => ({ ...current, reconEstimateCents: cents }))} disabled={busy} />
          </FieldRow>
          <div className="sm:col-span-2">
            <FieldRow label="Motivo" htmlFor="acquire-reason" error={showErrors ? acquireErrors.reason : null}>
              <Textarea className="rounded-[4px]" id="acquire-reason" rows={2} maxLength={500} value={acquire.reason} onChange={event => setAcquire(current => ({ ...current, reason: event.target.value }))} disabled={busy} />
            </FieldRow>
          </div>
        </div>
      </ActionDialog>
    </PageContainer>
  )
}
