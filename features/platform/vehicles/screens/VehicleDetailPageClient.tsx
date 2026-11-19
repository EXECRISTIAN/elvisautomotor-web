'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Pencil, Plus, RefreshCw } from 'lucide-react'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import {
  Attention,
  Code,
  DeskHeader,
  DeskSection,
  DeskTable,
  Facts,
  Notice,
  Panel,
  Pill,
  Status,
  Td,
  Th,
  TitleLine,
  Tr,
  Track,
  type DeskTone,
} from '@/features/platform/components/desk'
import { formatCentsForInput, parseDollarsToCents } from '@/features/platform/deals/lib/moneyInput'
import { recordReference, countLabel } from '@/features/platform/lib/format'
import {
  decideInventoryMerchandising,
  moveInventoryStock,
  openInventoryReconWorkItem,
  recordInventoryCost,
  submitInventoryMerchandising,
  transitionInventoryAcquisition,
  transitionInventoryReconWorkItem,
} from '../actions'
import {
  getInventoryVehicleDetail,
  saveConditionReport,
  saveVehicleHistory,
  setInventoryVehicleFeatured,
  updateInventoryVehicleDetails,
  type ConditionReport,
  type ReconWorkItem,
  type Section,
  type StaffOption,
  type VehicleDetail,
} from '../actions/detail'
import { LiveVehiclePhotos } from '../components/VehiclePhotos'
import { FUEL_OPTIONS, TRANSMISSION_OPTIONS, fuelLabel, transmissionLabel } from '@/features/lib/vehicleSpecs'
import { Windshield, WindshieldFigure } from '../components/Windshield'
import { InventoryFormDialog, type FieldErrors, type InventoryFormField } from '../components/InventoryFormDialog'
import {
  COST_TYPES,
  CONDITIONS,
  RATINGS,
  RECON_CATEGORIES,
  VIN_PATTERN,
  acquisitionSourceLabels,
  acquisitionStatusLabels,
  acquisitionStatusTones,
  conditionLabels,
  costTypeLabels,
  dealStatusLabels,
  eventTypeLabel,
  feedStatusLabels,
  feedStatusTones,
  formatDate,
  formatDateTime,
  formatMoneyCents,
  merchandisingStatusLabels,
  merchandisingStatusTones,
  personName,
  ratingLabels,
  reconCategoryLabels,
  reconStatusLabels,
  reconStatusTones,
  vehicleStatusLabels,
  vehicleStatusTones,
} from '../lib/inventoryLabels'

type DialogKind = 'details' | 'move' | 'cost' | 'recon-open' | 'recon-complete' | 'recon-cancel' | 'reject' | 'condition' | 'history'
type DialogState = { kind: DialogKind; targetId?: string; idempotencyKey: string }

const VEHICLES_HREF = `${basePath}/platform/vehicles`
const ACTIVE_STATUSES = ['available', 'service']

function key(kind: string) {
  return `vehicle-detail-${kind}:${crypto.randomUUID()}`
}

function lotStage(status: string, frontlineAt: string | null | undefined) {
  return status === 'service' && !frontlineAt ? 'prep' : status
}

function featureLines(value: string) {
  return [...new Set(value.split(/[\n,]/).map(item => item.trim()).filter(Boolean))]
}

function SectionError({ section, children }: { section: Section<unknown>; children: ReactNode }) {
  if (!section.ok) return <Notice tone="warn">Not available: {section.error}</Notice>
  return <>{children}</>
}

function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

export function VehicleDetailPageClient({
  id,
  initialDetail,
  initialError,
  timeZone,
  currencyCode,
  staff,
}: {
  id: string
  initialDetail: VehicleDetail | null
  initialError: string | null
  timeZone: string
  currencyCode: string
  staff: StaffOption[]
}) {
  const [detail, setDetail] = useState<VehicleDetail | null>(initialDetail)
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; tone: DeskTone } | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  const money = (cents: number | null | undefined) => formatMoneyCents(cents, currencyCode)

  const reload = async () => {
    setLoading(true)
    const response = await getInventoryVehicleDetail(id)
    if (response.success) {
      setDetail(response.detail)
      setError(null)
    } else {
      setError(response.error)
    }
    setLoading(false)
  }

  const breadcrumbs = [
    { type: 'link' as const, label: 'Inicio', href: basePath },
    { type: 'page' as const, label: 'Gestión' },
    { type: 'link' as const, label: 'Inventario', href: VEHICLES_HREF },
    { type: 'page' as const, label: detail ? detail.vehicle.stockNumber || 'Vehículo' : 'Vehículo' },
  ]

  if (!detail) {
    return (
      <PageContainer title="Vehículo" breadcrumbs={breadcrumbs} header={<DeskHeader title="Vehículo" tone="bad" status="Unavailable" />}>
        <div className="space-y-4 px-4 pb-24 md:px-6">
          <Notice tone="bad">{error || 'Vehicle not found'}</Notice>
          <Track>
            <Pill onClick={reload} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : undefined} /> Reintentar</Pill>
            <Pill asChild variant="plain"><Link href={VEHICLES_HREF}><ArrowLeft /> Inventario</Link></Pill>
          </Track>
        </div>
      </PageContainer>
    )
  }

  const { vehicle, stock } = detail
  const stage = lotStage(vehicle.status, stock?.frontlineAt)
  const editable = Boolean(stock) && ACTIVE_STATUSES.includes(vehicle.status)
  const notEditableReason = !stock ? 'Sin stock' : `${vehicleStatusLabels[vehicle.status] || vehicle.status} units cannot be edited`
  const reconItems = detail.reconWorkItems.ok ? detail.reconWorkItems.data : []
  const versions = detail.merchandisingVersions.ok ? detail.merchandisingVersions.data : []
  const latestVersion = versions[0] ?? null
  const acquisition = detail.acquisition.ok ? detail.acquisition.data : null
  const activeDeal = detail.deals.ok ? detail.deals.data.find(deal => deal.status !== 'cancelled') ?? null : null
  const reconDone = stock?.reconStatus === 'completed'
  const listingApproved = stock?.merchandisingStatus === 'approved'
  const needsPhotos = detail.images.length === 0
  const needsDetails = !vehicle.description.trim() || !(Number(vehicle.priceCents) > 0)
  const publicAction = stock?.publicListing.action ?? null

  const run = async (label: string, work: () => Promise<{ success: boolean; error?: string }>, success: string) => {
    setBusy(label)
    setMessage(null)
    try {
      const response = await work()
      if (response.success) setMessage({ text: success, tone: 'ok' })
      else setMessage({ text: response.error || 'Unable to save.', tone: 'bad' })
    } catch {
      setMessage({ text: 'No se pudo guardar. Recarga para ver el estado actual.', tone: 'bad' })
    } finally {
      await reload()
      setBusy(null)
    }
  }

  const openDialog = (kind: DialogKind, initial: Record<string, string>, targetId?: string) => {
    setDialog({ kind, targetId, idempotencyKey: key(kind) })
    setValues(initial)
    setFieldErrors({})
    setFormError(null)
    setMessage(null)
  }
  const closeDialog = () => {
    if (busy === 'dialog') return
    setDialog(null)
  }

  // Actions -------------------------------------------------------------------------------------

  const submitListing = () => stock && run('listing', () => submitInventoryMerchandising({ stockId: stock.id, reason: 'Enviado desde la ficha del vehículo', idempotencyKey: key('submit') }), 'Listing submitted for approval.')
  const approveVersion = (versionId: string, updatedAt: string, reapprove = false) => run('listing', () => decideInventoryMerchandising({
    id: versionId, decision: 'approved', reason: reapprove ? 'Re-aprobado desde la ficha del vehículo' : 'Aprobado desde la ficha del vehículo', expectedUpdatedAt: updatedAt, idempotencyKey: key('approve'),
  }), reapprove ? 'Publicación aprobada nuevamente.' : 'Publicación aprobada.')
  const startRecon = (item: ReconWorkItem) => run(item.id, () => transitionInventoryReconWorkItem({ id: item.id, toStatus: 'in-progress', expectedUpdatedAt: item.updatedAt, reason: 'Iniciado desde la ficha del vehículo', idempotencyKey: key('recon-start') }), 'Work started.')
  const advanceAcquisition = (toStatus: 'reconditioning' | 'frontline') => acquisition && run('acquisition', () => transitionInventoryAcquisition({
    id: acquisition.id, toStatus, expectedUpdatedAt: acquisition.updatedAt, reason: toStatus === 'frontline' ? 'Pasado a exhibición desde la ficha del vehículo' : 'Enviado a preparación desde la ficha del vehículo', idempotencyKey: key('acquisition'),
  }), toStatus === 'frontline' ? 'Pasó a exhibición.' : 'Enviado a preparación.')

  const openDetails = () => openDialog('details', {
    vin: vehicle.vin, year: String(vehicle.year), condition: vehicle.condition || 'used', make: vehicle.make, model: vehicle.model, trim: vehicle.trim,
    exteriorColor: vehicle.exteriorColor, interiorColor: vehicle.interiorColor, fuelType: vehicle.fuelType, transmission: vehicle.transmission, engine: vehicle.engine, mileage: vehicle.mileage == null ? '' : String(vehicle.mileage),
    retail: vehicle.priceCents == null ? '' : formatCentsForInput(vehicle.priceCents), list: vehicle.listPriceCents == null ? '' : formatCentsForInput(vehicle.listPriceCents),
    priceChangeReason: '', features: vehicle.features.join('\n'), description: vehicle.description,
  })
  const openCondition = (report?: ConditionReport) => openDialog('condition', report ? {
    reportDate: new Date(report.reportDate).toLocaleDateString('en-CA', { timeZone }), inspector: report.inspector, overallCondition: report.overallCondition || '',
    mechanicalRating: report.mechanicalRating || '', bodyRating: report.bodyRating || '', interiorRating: report.interiorRating || '',
    issues: report.issues.map(issue => issue.description).join('\n'), estimatedRepairs: report.estimatedRepairs == null ? '' : String(report.estimatedRepairs), notes: report.notes,
  } : { reportDate: new Date().toLocaleDateString('en-CA', { timeZone }), inspector: '', overallCondition: '', mechanicalRating: '', bodyRating: '', interiorRating: '', issues: '', estimatedRepairs: '', notes: '' }, report?.id)
  const openHistory = () => {
    const history = detail.history
    openDialog('history', {
      acquisitionDate: history?.acquisitionDate ? new Date(history.acquisitionDate).toLocaleDateString('en-CA', { timeZone }) : '',
      acquisitionSource: history?.acquisitionSource || (acquisition ? acquisitionSourceLabels[acquisition.acquisitionSource] || acquisition.acquisitionSource : ''),
      previousOwners: history?.previousOwners == null ? '' : String(history.previousOwners), hasAccidents: history?.hasAccidents ? 'yes' : '',
      accidentDetails: history?.accidentDetails || '', serviceRecords: history?.serviceRecords || '', titleStatus: history?.titleStatus || '', notes: history?.notes || '',
    }, history?.id)
  }

  const submitDialog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!dialog) return
    const v = (name: string) => (values[name] || '').trim()
    const errors: FieldErrors = {}
    const cents = (name: string, label: string, { required = false, positive = false } = {}) => {
      if (!v(name)) {
        if (required) errors[name] = `${label} is required`
        return null
      }
      const parsed = parseDollarsToCents(v(name))
      if (parsed == null) errors[name] = `Enter an amount such as $33,450`
      else if (positive && parsed <= 0) errors[name] = `${label} must be more than zero`
      return parsed
    }
    const whole = (name: string, label: string, { required = false, max = 2_000_000 } = {}) => {
      if (!v(name)) {
        if (required) errors[name] = `${label} is required`
        return null
      }
      const parsed = Number(v(name).replace(/,/g, ''))
      if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > max) {
        errors[name] = `${label} must be a whole number`
        return null
      }
      return parsed
    }
    const requireText = (name: string, label: string) => { if (!v(name)) errors[name] = `${label} is required` }

    let work: (() => Promise<{ success: boolean; error?: string; rejected?: boolean }>) | null = null
    let success = 'Saved.'
    if (dialog.kind === 'details' && stock) {
      const vin = v('vin').toUpperCase()
      if (!VIN_PATTERN.test(vin)) errors.vin = '17 characters, no I, O or Q'
      const year = whole('year', 'Año', { required: true, max: 9999 })
      const maxYear = new Date().getFullYear() + 2
      if (year != null && (year < 1900 || year > maxYear)) errors.year = `Between 1900 and ${maxYear}`
      requireText('make', 'Marca')
      requireText('model', 'Modelo')
      const mileage = whole('mileage', 'Kilometraje')
      const priceCents = cents('retail', 'Retail price', { required: true, positive: true })
      const listPriceCents = cents('list', 'List price')
      const features = featureLines(values.features || '')
      if (features.some(feature => feature.length > 200)) errors.features = 'Each feature must be at most 200 characters'
      if (features.length > 100) errors.features = 'At most 100 features'
      if (Object.keys(errors).length === 0) {
        work = () => updateInventoryVehicleDetails({
          stockId: stock.id, vehicleId: vehicle.id, vin, year: year!, make: v('make'), model: v('model'), trim: v('trim'),
          exteriorColor: v('exteriorColor'), interiorColor: v('interiorColor'), fuelType: v('fuelType'), transmission: v('transmission'), engine: v('engine'), condition: v('condition') || 'used', mileage,
          features, priceCents: priceCents!, listPriceCents: listPriceCents ?? priceCents!, description: values.description || '',
          priceChangeReason: v('priceChangeReason'), expectedUpdatedAt: stock.updatedAt, idempotencyKey: dialog.idempotencyKey,
        })
        success = stock.merchandisingStatus === 'draft' ? 'Datos guardados.' : 'Datos guardados. La publicación volvió a borrador y requiere aprobación.'
      }
    } else if (dialog.kind === 'move' && stock) {
      requireText('locationCode', 'Ubicación')
      if (Object.keys(errors).length === 0) {
        work = () => moveInventoryStock({ stockId: stock.id, locationCode: v('locationCode').toUpperCase(), locationLabel: v('locationLabel') || v('locationCode').toUpperCase(), expectedUpdatedAt: stock.updatedAt, reason: 'Movido desde la ficha del vehículo', idempotencyKey: dialog.idempotencyKey })
        success = 'Unit moved.'
      }
    } else if (dialog.kind === 'cost' && stock) {
      if (!COST_TYPES.includes(v('costType') as typeof COST_TYPES[number])) errors.costType = 'Choose a cost type'
      const amountCents = cents('amount', 'Importe', { required: true, positive: true })
      if (Object.keys(errors).length === 0) {
        work = () => recordInventoryCost({ stockId: stock.id, costType: v('costType'), amountCents: amountCents!, reference: v('reference') || undefined, reason: 'Costo registrado desde la ficha del vehículo', idempotencyKey: dialog.idempotencyKey })
        success = 'Cost recorded.'
      }
    } else if (dialog.kind === 'recon-open' && stock) {
      requireText('title', 'Tarea')
      if (!RECON_CATEGORIES.includes(v('category') as typeof RECON_CATEGORIES[number])) errors.category = 'Choose a category'
      const estimatedCostCents = cents('estimate', 'Estimate')
      if (v('dueAt') && Number.isNaN(new Date(`${v('dueAt')}T12:00:00`).getTime())) errors.dueAt = 'Enter a valid date'
      if (Object.keys(errors).length === 0) {
        work = () => openInventoryReconWorkItem({
          stockId: stock.id, title: v('title'), category: v('category'), estimatedCostCents: estimatedCostCents ?? 0, vendorName: v('vendorName'),
          assignedToId: v('assignedToId') || null, dueAt: v('dueAt') ? new Date(`${v('dueAt')}T12:00:00`).toISOString() : null,
          reason: 'Abierto desde la ficha del vehículo', idempotencyKey: dialog.idempotencyKey,
        })
        success = 'Work item added.'
      }
    } else if (dialog.kind === 'recon-complete' || dialog.kind === 'recon-cancel') {
      const item = reconItems.find(entry => entry.id === dialog.targetId)
      const actualCostCents = dialog.kind === 'recon-complete' ? cents('actual', 'Actual cost', { required: true }) : null
      if (dialog.kind === 'recon-cancel') requireText('reason', 'Motivo')
      if (item && Object.keys(errors).length === 0) {
        work = () => transitionInventoryReconWorkItem({
          id: item.id, toStatus: dialog.kind === 'recon-complete' ? 'completed' : 'cancelled', actualCostCents: actualCostCents ?? undefined,
          expectedUpdatedAt: item.updatedAt, reason: dialog.kind === 'recon-complete' ? 'Completed from the vehicle page' : v('reason'), idempotencyKey: dialog.idempotencyKey,
        })
        success = dialog.kind === 'recon-complete' ? 'Tarea terminada.' : 'Tarea cancelada.'
      }
    } else if (dialog.kind === 'reject') {
      const version = versions.find(entry => entry.id === dialog.targetId)
      requireText('reason', 'Motivo')
      if (version && Object.keys(errors).length === 0) {
        work = () => decideInventoryMerchandising({ id: version.id, decision: 'rejected', reason: v('reason'), expectedUpdatedAt: version.updatedAt, idempotencyKey: dialog.idempotencyKey })
        success = 'Listing rejected.'
      }
    } else if (dialog.kind === 'condition') {
      if (!v('reportDate') || Number.isNaN(new Date(`${v('reportDate')}T12:00:00`).getTime())) errors.reportDate = 'Enter a valid date'
      const estimatedRepairs = whole('estimatedRepairs', 'Estimated repairs', { max: 10_000_000 })
      if (!v('overallCondition')) errors.overallCondition = 'Choose an overall rating'
      if (Object.keys(errors).length === 0) {
        work = () => saveConditionReport({
          id: dialog.targetId, vehicleId: vehicle.id, rooftopId: vehicle.rooftopId, reportDate: new Date(`${v('reportDate')}T12:00:00`).toISOString(),
          inspector: v('inspector'), overallCondition: v('overallCondition'), mechanicalRating: v('mechanicalRating'), bodyRating: v('bodyRating'),
          interiorRating: v('interiorRating'), issues: (values.issues || '').split('\n'), estimatedRepairs, notes: values.notes || '',
        })
        success = 'Condition report saved.'
      }
    } else if (dialog.kind === 'history') {
      if (v('acquisitionDate') && Number.isNaN(new Date(`${v('acquisitionDate')}T12:00:00`).getTime())) errors.acquisitionDate = 'Enter a valid date'
      const previousOwners = whole('previousOwners', 'Dueños anteriores', { max: 99 })
      if (values.hasAccidents === 'yes' && !v('accidentDetails')) errors.accidentDetails = 'Describe the accident history'
      if (Object.keys(errors).length === 0) {
        work = () => saveVehicleHistory({
          id: dialog.targetId, vehicleId: vehicle.id, rooftopId: vehicle.rooftopId,
          acquisitionDate: v('acquisitionDate') ? new Date(`${v('acquisitionDate')}T12:00:00`).toISOString() : '',
          acquisitionSource: v('acquisitionSource'), previousOwners, hasAccidents: values.hasAccidents === 'yes', accidentDetails: values.accidentDetails || '',
          serviceRecords: values.serviceRecords || '', titleStatus: v('titleStatus'), notes: values.notes || '',
        })
        success = 'Vehicle history saved.'
      }
    }

    setFieldErrors(errors)
    if (!work) return
    setBusy('dialog')
    setFormError(null)
    try {
      const response = await work()
      if (!response.success) {
        setFormError(response.error || 'Unable to save.')
        return
      }
      setDialog(null)
      setMessage({ text: success, tone: 'ok' })
      await reload()
    } catch {
      setFormError('No se pudo guardar. Tus datos se conservan para que reintentes.')
    } finally {
      setBusy(null)
    }
  }

  // Next step: the same one-action-at-a-time order as the inventory desk -------------------------

  const activeRecon = reconItems.find(item => ['open', 'in-progress'].includes(item.status)) ?? null
  let nextStep: { label: string; onClick: () => void; disabledReason?: string } | null = null
  if (stock && editable) {
    if (acquisition?.status === 'arrived') nextStep = { label: 'Enviar a preparación', onClick: () => advanceAcquisition('reconditioning') }
    else if (!reconDone) {
      nextStep = !activeRecon
        ? { label: 'Agregar tarea', onClick: () => openDialog('recon-open', { title: '', category: 'inspection', estimate: '', vendorName: '', assignedToId: '', dueAt: '' }) }
        : activeRecon.status === 'in-progress'
          ? { label: 'Terminar tarea', onClick: () => openDialog('recon-complete', { actual: '' }, activeRecon.id) }
          : { label: 'Iniciar tarea', onClick: () => startRecon(activeRecon) }
    } else if (!listingApproved || publicAction) {
      if (publicAction === 'reapprove' && latestVersion) nextStep = { label: 'Volver a aprobar la publicación', onClick: () => approveVersion(latestVersion.id, latestVersion.updatedAt, true) }
      else if (stock.merchandisingStatus === 'submitted' && latestVersion?.status === 'submitted') nextStep = { label: 'Aprobar publicación', onClick: () => approveVersion(latestVersion.id, latestVersion.updatedAt) }
      else if (needsPhotos) nextStep = { label: 'Agregar fotos', onClick: () => document.getElementById('vehicle-photos')?.scrollIntoView({ behavior: 'smooth' }) }
      else if (needsDetails) nextStep = { label: 'Agregar descripción', onClick: openDetails }
      else nextStep = { label: publicAction === 'resubmit' ? 'Reenviar publicación' : 'Enviar publicación a revisión', onClick: () => void submitListing() }
    } else if (acquisition?.status === 'reconditioning') nextStep = { label: 'Pasar a exhibición', onClick: () => advanceAcquisition('frontline') }
  }

  // Render ----------------------------------------------------------------------------------------

  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`
  // Aged per the existing 60-day mark; a sold unit's clock has stopped.
  const aged = Boolean(stock) && vehicle.status !== 'sold' && stock!.daysInStock != null && stock!.daysInStock >= 60
  const stateLine = [
    vehicleStatusLabels[stage] || stage,
    stock ? (stock.publicListing.live ? 'live on storefront' : 'not live') : 'not stocked',
    nextStep ? `next: ${nextStep.label.toLowerCase()}` : null,
  ].filter(Boolean).join(' · ')
  const header = (
    <DeskHeader
      eyebrow={<Link href={VEHICLES_HREF} className="inline-flex min-h-11 items-center gap-1 hover:text-foreground sm:min-h-0"><ArrowLeft className="size-3" /> Inventario</Link>}
      title={title}
      tone={vehicleStatusTones[stage] || 'idle'}
      status={vehicleStatusLabels[stage] || stage}
      meta={<span className="flex flex-wrap gap-x-3 gap-y-1"><span className="font-medium text-foreground">{stateLine}</span><Code>{vehicle.vin}</Code>{vehicle.rooftopName && <span>{vehicle.rooftopName}</span>}</span>}
      actions={
        <Track>
          <Pill variant="plain" onClick={reload} disabled={loading} aria-label="Actualizar"><RefreshCw className={loading ? 'animate-spin' : undefined} /><span className="max-sm:sr-only">Actualizar</span></Pill>
          <Pill onClick={openDetails} disabled={!editable || Boolean(busy)} title={editable ? undefined : notEditableReason}><Pencil /> Editar</Pill>
          {nextStep && <Pill variant="primary" onClick={nextStep.onClick} disabled={Boolean(busy)}>{nextStep.label}</Pill>}
        </Track>
      }
    />
  )

  const detailsFields: InventoryFormField[] = [
    { name: 'vin', label: 'VIN / chasis', maxLength: 17, wide: true },
    { name: 'year', label: 'Año', type: 'number', min: 1900 },
    { name: 'condition', label: 'Condición', type: 'select', options: CONDITIONS.map(value => ({ value, label: conditionLabels[value] })) },
    { name: 'make', label: 'Marca', maxLength: 100 },
    { name: 'model', label: 'Modelo', maxLength: 100 },
    { name: 'trim', label: 'Versión', maxLength: 100, required: false },
    { name: 'mileage', label: 'Kilometraje (km)', type: 'number', min: 0, required: false },
    { name: 'exteriorColor', label: 'Color exterior', maxLength: 100, required: false },
    { name: 'interiorColor', label: 'Color interior', maxLength: 100, required: false },
    { name: 'fuelType', label: 'Combustible', type: 'select', required: false, options: FUEL_OPTIONS },
    { name: 'transmission', label: 'Transmisión', type: 'select', required: false, options: TRANSMISSION_OPTIONS },
    { name: 'engine', label: 'Cilindrada / motor', maxLength: 40, required: false, placeholder: '1.6, 2.0 TSI…' },
    { name: 'retail', label: `Precio de venta (${currencyCode})`, type: 'money' },
    { name: 'list', label: `Precio de lista (${currencyCode})`, type: 'money', required: false, hint: 'Si queda vacío se usa el precio de venta' },
    { name: 'priceChangeReason', label: 'Motivo del cambio de precio', maxLength: 500, required: false, wide: true },
    { name: 'features', label: 'Equipamiento (uno por línea)', type: 'textarea', required: false },
    { name: 'description', label: 'Descripción', type: 'textarea', maxLength: 4000, required: false },
  ]
  const ratingOptions = RATINGS.map(value => ({ value, label: ratingLabels[value] }))
  const dialogConfig: Record<DialogKind, { title: string; fields: InventoryFormField[]; submitLabel?: string }> = {
    details: { title: 'Editar datos del vehículo', fields: detailsFields },
    move: { title: 'Mover unidad', fields: [{ name: 'locationCode', label: 'Código de ubicación', maxLength: 80 }, { name: 'locationLabel', label: 'Nombre de la ubicación', maxLength: 200, required: false }], submitLabel: 'Mover' },
    cost: { title: 'Registrar costo', fields: [
      { name: 'costType', label: 'Tipo de costo', type: 'select', options: COST_TYPES.map(value => ({ value, label: costTypeLabels[value] })) },
      { name: 'amount', label: `Importe (${currencyCode})`, type: 'money' },
      { name: 'reference', label: 'Factura o referencia', maxLength: 200, required: false, wide: true },
    ], submitLabel: 'Registrar' },
    'recon-open': { title: 'Agregar tarea', fields: [
      { name: 'title', label: 'Tarea', maxLength: 200, wide: true },
      { name: 'category', label: 'Categoría', type: 'select', options: RECON_CATEGORIES.map(value => ({ value, label: reconCategoryLabels[value] })) },
      { name: 'estimate', label: `Presupuesto (${currencyCode})`, type: 'money', required: false },
      { name: 'vendorName', label: 'Proveedor', maxLength: 200, required: false },
      { name: 'assignedToId', label: 'Asignado a', type: 'select', required: false, options: staff.map(person => ({ value: person.id, label: person.name })) },
      { name: 'dueAt', label: 'Fecha límite', type: 'date', required: false },
    ], submitLabel: 'Agregar' },
    'recon-complete': { title: 'Terminar tarea', fields: [{ name: 'actual', label: `Costo real (${currencyCode})`, type: 'money' }], submitLabel: 'Terminar' },
    'recon-cancel': { title: 'Cancelar tarea', fields: [{ name: 'reason', label: 'Motivo', type: 'textarea', maxLength: 500 }], submitLabel: 'Cancelar tarea' },
    reject: { title: 'Rechazar publicación', fields: [{ name: 'reason', label: 'Motivo', type: 'textarea', maxLength: 500 }], submitLabel: 'Rechazar' },
    condition: { title: dialog?.targetId ? 'Editar informe de estado' : 'Nuevo informe de estado', fields: [
      { name: 'reportDate', label: 'Fecha de inspección', type: 'date' },
      { name: 'inspector', label: 'Inspector', maxLength: 200, required: false },
      { name: 'overallCondition', label: 'General', type: 'select', options: ratingOptions },
      { name: 'mechanicalRating', label: 'Mecánica', type: 'select', required: false, options: ratingOptions },
      { name: 'bodyRating', label: 'Carrocería', type: 'select', required: false, options: ratingOptions },
      { name: 'interiorRating', label: 'Interior', type: 'select', required: false, options: ratingOptions },
      { name: 'estimatedRepairs', label: 'Reparaciones estimadas ($)', type: 'number', min: 0, required: false },
      { name: 'issues', label: 'Problemas (uno por línea)', type: 'textarea', required: false },
      { name: 'notes', label: 'Notas', type: 'textarea', maxLength: 4000, required: false },
    ] },
    history: { title: 'Historial del vehículo', fields: [
      { name: 'acquisitionDate', label: 'Fecha de ingreso', type: 'date', required: false },
      { name: 'acquisitionSource', label: 'Origen', maxLength: 200, required: false },
      { name: 'previousOwners', label: 'Dueños anteriores', type: 'number', min: 0, max: 99, required: false },
      { name: 'titleStatus', label: 'Estado de la documentación', maxLength: 100, required: false, placeholder: 'Sin observaciones' },
      { name: 'hasAccidents', label: 'Historial de choques', type: 'checkbox', wide: true },
      ...(values.hasAccidents === 'yes' ? [{ name: 'accidentDetails', label: 'Detalle de choques', type: 'textarea' as const, maxLength: 4000 }] : []),
      { name: 'serviceRecords', label: 'Registros de service', type: 'textarea', maxLength: 4000, required: false },
      { name: 'notes', label: 'Notas', type: 'textarea', maxLength: 4000, required: false },
    ] },
  }
  const config = dialog ? dialogConfig[dialog.kind] : null

  const listingLive = stock?.publicListing.live
  return (
    <PageContainer title={title} header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-8 px-4 pb-24 md:px-6">
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        {error && <Notice tone="warn">Reload failed: {error}</Notice>}
        {!editable && <Notice tone="idle">{notEditableReason}</Notice>}

        <div className="min-w-0 space-y-3">
          <Windshield label="Precio, stock y días">
            <WindshieldFigure label="Precio" value={money(vehicle.priceCents)} sub={vehicle.listPriceCents != null && vehicle.listPriceCents !== vehicle.priceCents ? `List ${money(vehicle.listPriceCents)}` : undefined} />
            <WindshieldFigure label="Stock #" value={vehicle.stockNumber || '-'} />
            {stock && (
              <WindshieldFigure
                label="Días en stock"
                value={stock.daysInStock ?? 'Sold'}
                attention={aged}
                sub={stock.soldAt ? `Sold ${formatDate(stock.soldAt, timeZone)}` : aged ? 'Aged 60+ days' : undefined}
              />
            )}
            {stock?.cost && <WindshieldFigure label="Costo total" value={money(stock.cost.totalCostCents)} sub={vehicle.priceCents ? `Margen ${money(vehicle.priceCents - stock.cost.totalCostCents)}` : undefined} />}
          </Windshield>
          {stock && (
            <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
              <span className="inline-flex min-w-0 items-center gap-2"><span className="text-muted-foreground">Página web</span><Status tone={listingLive ? 'ok' : publicAction ? 'warn' : 'idle'}>{listingLive ? 'Publicado' : 'No publicado'}</Status>{!listingLive && stock.publicListing.reason && <span className="min-w-0 truncate text-muted-foreground">{stock.publicListing.reason}</span>}</span>
              <span className="inline-flex items-center gap-2"><span className="text-muted-foreground">Publicación</span><Status tone={merchandisingStatusTones[stock.merchandisingStatus]}>{merchandisingStatusLabels[stock.merchandisingStatus] || stock.merchandisingStatus}</Status></span>
              <span className="inline-flex items-center gap-2"><span className="text-muted-foreground">Feed</span><Status tone={feedStatusTones[stock.feedStatus]}>{feedStatusLabels[stock.feedStatus] || stock.feedStatus}</Status></span>
            </div>
          )}
        </div>

        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="min-w-0 space-y-8">
            <DeskSection title="Datos y especificaciones" id="vehicle-identity" actions={<Track><Pill size="sm" onClick={() => run('featured', () => setInventoryVehicleFeatured(vehicle.id, !vehicle.isFeatured), vehicle.isFeatured ? 'Ya no se destaca en la página principal.' : 'Destacado en la página principal.')} disabled={Boolean(busy)} aria-pressed={vehicle.isFeatured}>{vehicle.isFeatured ? '★ Destacado' : '☆ Destacar'}</Pill><Pill size="sm" onClick={openDetails} disabled={!editable || Boolean(busy)} title={editable ? undefined : notEditableReason}><Pencil /> Editar</Pill></Track>}>
              <div className="grid gap-x-8 sm:grid-cols-2">
                <Facts items={[
                  { label: 'VIN / chasis', value: vehicle.vin, mono: true },
                  { label: 'Stock #', value: vehicle.stockNumber, mono: true },
                  { label: 'Año', value: vehicle.year, mono: true },
                  { label: 'Marca', value: vehicle.make },
                  { label: 'Modelo', value: vehicle.model },
                  { label: 'Versión', value: vehicle.trim || '-' },
                ]} />
                <Facts items={[
                  { label: 'Condición', value: vehicle.condition ? conditionLabels[vehicle.condition] || vehicle.condition : '-' },
                  { label: 'Kilometraje', value: vehicle.mileage == null ? '-' : `${vehicle.mileage.toLocaleString('es-AR')} km`, mono: true },
                  { label: 'Exterior', value: vehicle.exteriorColor || '-' },
                  { label: 'Interior', value: vehicle.interiorColor || '-' },
                  { label: 'Combustible', value: fuelLabel(vehicle.fuelType) || '-' },
                  { label: 'Transmisión', value: transmissionLabel(vehicle.transmission) || '-' },
                  { label: 'Cilindrada', value: vehicle.engine || '-' },
                  { label: 'Precio de venta', value: money(vehicle.priceCents), mono: true },
                  { label: 'Precio de lista', value: money(vehicle.listPriceCents), mono: true },
                ]} />
              </div>
              {vehicle.features.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Equipamiento">
                  {vehicle.features.map(feature => <li key={feature} className="rounded-[4px] border px-2 py-0.5 text-xs">{feature}</li>)}
                </ul>
              )}
              <div className="mt-3 border-t pt-3 text-sm">
                <p className="text-[12px] font-medium text-muted-foreground">Descripción</p>
                <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">{vehicle.description || 'No description'}</p>
              </div>
            </DeskSection>

            <DeskSection title="Fotos" id="vehicle-photos" count={detail.images.length}>
              {stock && editable ? (
                <LiveVehiclePhotos stockId={stock.id} images={detail.images} label="Fotos (la primera es la principal)" onChanged={reload} />
              ) : detail.images.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {detail.images.map(image => image.url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img key={image.id} src={image.url} alt="" className="aspect-[4/3] w-full rounded-[4px] bg-muted object-cover" />
                    : <div key={image.id} className="aspect-[4/3] rounded-[4px] bg-muted" />)}
                </div>
              ) : <EmptyRow>Sin fotos</EmptyRow>}
            </DeskSection>

            <DeskSection
              title="Preparación"
              id="vehicle-recon"
              count={reconItems.length}
              actions={stock && editable && <Track><Pill size="sm" disabled={Boolean(busy)} onClick={() => openDialog('recon-open', { title: '', category: 'inspection', estimate: '', vendorName: '', assignedToId: '', dueAt: '' })}><Plus /> Agregar</Pill></Track>}
            >
              <SectionError section={detail.reconWorkItems}>
                {!stock ? <EmptyRow>Sin stock</EmptyRow> : reconItems.length === 0 ? <EmptyRow>Sin tareas</EmptyRow> : (
                  <DeskTable aria-label="Tareas de preparación">
                    <thead>
                      <tr>
                        <Th>Tarea</Th>
                        <Th>Estado</Th>
                        <Th priority={2}>Vence</Th>
                        <Th align="right" priority={3}>Costo</Th>
                        <Th align="right"><span className="sr-only">Acciones</span></Th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconItems.map(item => {
                        const open = ['open', 'in-progress'].includes(item.status)
                        const overdue = open && item.dueAt && new Date(item.dueAt).getTime() < Date.now()
                        return (
                          <Tr key={item.id}>
                            <Td className="min-w-0">
                              <p className="break-words font-medium text-foreground">{item.title}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{[reconCategoryLabels[item.category] || item.category, item.vendorName, item.assignedTo?.name].filter(Boolean).join(' · ')}</p>
                              {item.dueAt && <p className="mt-0.5 text-xs text-muted-foreground md:hidden">Due {formatDate(item.dueAt, timeZone)}{overdue && <> <Attention>Vencida</Attention></>}</p>}
                            </Td>
                            <Td><Status tone={reconStatusTones[item.status]}>{reconStatusLabels[item.status] || item.status}</Status></Td>
                            <Td priority={2} className="whitespace-nowrap">
                              {item.dueAt ? <span className="inline-flex items-center gap-2">{formatDate(item.dueAt, timeZone)}{overdue && <Attention>Vencida</Attention>}</span> : <span className="text-muted-foreground">-</span>}
                              {item.completedAt && <p className="text-xs text-muted-foreground">Done {formatDate(item.completedAt, timeZone)}</p>}
                            </Td>
                            <Td align="right" priority={3} className="whitespace-nowrap text-xs text-muted-foreground">
                              {item.actualCostCents != null ? <span className="text-foreground">{money(item.actualCostCents)}</span> : item.estimatedCostCents != null ? `Est. ${money(item.estimatedCostCents)}` : '-'}
                            </Td>
                            <Td align="right" className="whitespace-nowrap">
                              {open && editable && (
                                <div className="flex flex-wrap items-center justify-end gap-1">
                                  {item.status === 'open' && <Pill size="sm" className="max-md:h-10" disabled={!editable || Boolean(busy)} onClick={() => startRecon(item)}>Iniciar</Pill>}
                                  <Pill size="sm" className="max-md:h-10" disabled={!editable || Boolean(busy)} onClick={() => openDialog('recon-complete', { actual: item.estimatedCostCents ? formatCentsForInput(item.estimatedCostCents) : '' }, item.id)}>Terminar</Pill>
                                  <Pill size="sm" variant="plain" className="max-md:h-10" disabled={!editable || Boolean(busy)} onClick={() => openDialog('recon-cancel', { reason: '' }, item.id)}>Cancelar</Pill>
                                </div>
                              )}
                            </Td>
                          </Tr>
                        )
                      })}
                    </tbody>
                  </DeskTable>
                )}
              </SectionError>
            </DeskSection>

            <DeskSection
              title="Revisión de la publicación"
              id="vehicle-listing"
              count={versions.length}
              actions={stock && editable && (
                <Track>
                  <Pill
                    size="sm"
                    disabled={Boolean(busy) || stock.merchandisingStatus === 'submitted' || needsPhotos || needsDetails}
                    title={stock.merchandisingStatus === 'submitted' ? 'Review already pending' : needsPhotos ? 'Add a photo first' : needsDetails ? 'Add a price and description first' : undefined}
                    onClick={() => void submitListing()}
                  >
                    Enviar a revisión
                  </Pill>
                </Track>
              )}
            >
              <SectionError section={detail.merchandisingVersions}>
                {stock && (
                  <p className="mb-3 flex flex-wrap items-baseline gap-x-2 text-sm">
                    <TitleLine as="span" tone={merchandisingStatusTones[stock.merchandisingStatus]} className="font-medium">{merchandisingStatusLabels[stock.merchandisingStatus] || stock.merchandisingStatus}</TitleLine>
                    {(stock.merchandisingStatus === 'submitted' && (needsPhotos || needsDetails)) && <span className="text-xs text-muted-foreground">Needs {needsPhotos ? 'photos' : 'price and description'}</span>}
                    {stock.merchandisingStatus !== 'submitted' && (needsPhotos || needsDetails) && <span className="text-xs text-amber-700 dark:text-amber-400">Needs {needsPhotos ? 'photos' : 'price and description'} to submit</span>}
                  </p>
                )}
                {versions.length === 0 ? <EmptyRow>Sin revisiones todavía</EmptyRow> : (
                  <Panel className="divide-y">
                    {versions.map((version, index) => {
                      const current = index === 0
                      return (
                        <div key={version.id} className="min-w-0 px-4 py-3">
                          <TitleLine tone={merchandisingStatusTones[version.status]} status={merchandisingStatusLabels[version.status]} className="text-sm font-medium">
                            Version {version.version}
                            <span className="font-normal text-muted-foreground"> · {merchandisingStatusLabels[version.status] || version.status}</span>
                          </TitleLine>
                          <p className="mt-0.5 flex flex-wrap gap-x-2 pl-4 text-xs text-muted-foreground">
                            <span>Submitted {formatDateTime(version.submittedAt, timeZone)} by {personName(version.submittedBy)}</span>
                            {version.decidedAt && <span>· Decided {formatDateTime(version.decidedAt, timeZone)} by {personName(version.decidedBy)}</span>}
                            {version.snapshot?.priceCents != null && <span>· {money(version.snapshot.priceCents)}</span>}
                            {Array.isArray(version.snapshot?.images) && <span>· {countLabel(version.snapshot.images.length, 'photo')}</span>}
                          </p>
                          {version.decisionReason && <p className="mt-1 break-words pl-4 text-xs">{version.decisionReason}</p>}
                          {current && version.status === 'submitted' && stock?.merchandisingStatus === 'submitted' && (
                            <Track className="ml-4 mt-2">
                              {editable && <Pill size="sm" className="max-md:h-10" disabled={Boolean(busy)} onClick={() => approveVersion(version.id, version.updatedAt)}>Aprobar</Pill>}
                              {/* Rejecting a stale review stays open on a sold unit; approving would relist it. */}
                              <Pill size="sm" disabled={!stock || Boolean(busy)} onClick={() => openDialog('reject', { reason: '' }, version.id)}>Rechazar</Pill>
                            </Track>
                          )}
                          {current && editable && version.status === 'approved' && publicAction === 'reapprove' && (
                            <Track className="ml-4 mt-2">
                              <Pill size="sm" className="max-md:h-10" disabled={!editable || Boolean(busy)} onClick={() => approveVersion(version.id, version.updatedAt, true)}>Volver a aprobar</Pill>
                            </Track>
                          )}
                        </div>
                      )
                    })}
                  </Panel>
                )}
              </SectionError>
            </DeskSection>

            <DeskSection title="Informes de estado" id="vehicle-condition" count={detail.conditionReports.length} actions={<Track><Pill size="sm" disabled={Boolean(busy)} onClick={() => openCondition()}><Plus /> Nuevo</Pill></Track>}>
              {detail.conditionReports.length === 0 ? <EmptyRow>Sin informes de estado</EmptyRow> : (
                <Panel className="divide-y">
                  {detail.conditionReports.map(report => (
                    <div key={report.id} className="min-w-0 px-4 py-3">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <TitleLine tone={report.overallCondition === 'poor' ? 'bad' : report.overallCondition === 'fair' ? 'warn' : report.overallCondition ? 'ok' : 'idle'} className="text-sm font-medium">
                          {formatDate(report.reportDate, timeZone)}
                          <span className="font-normal text-muted-foreground"> · {report.overallCondition ? ratingLabels[report.overallCondition] : 'Sin calificar'}</span>
                        </TitleLine>
                        <Track><Pill size="sm" variant="plain" className="max-sm:h-11" disabled={Boolean(busy)} onClick={() => openCondition(report)}>Editar</Pill></Track>
                      </div>
                      <p className="mt-0.5 flex flex-wrap gap-x-2 pl-4 text-xs text-muted-foreground">
                        {report.inspector && <span>{report.inspector}</span>}
                        {report.mechanicalRating && <span>· Mechanical {ratingLabels[report.mechanicalRating]}</span>}
                        {report.bodyRating && <span>· Body {ratingLabels[report.bodyRating]}</span>}
                        {report.interiorRating && <span>· Interior {ratingLabels[report.interiorRating]}</span>}
                        {report.estimatedRepairs != null && <span>· Repairs ${report.estimatedRepairs.toLocaleString('es-AR')}</span>}
                      </p>
                      {report.issues.length > 0 && <ul className="mt-1 list-disc space-y-0.5 pl-8 text-xs">{report.issues.map((issue, index) => <li key={index} className="break-words">{issue.description}</li>)}</ul>}
                      {report.notes && <p className="mt-1 whitespace-pre-line break-words pl-4 text-xs text-muted-foreground">{report.notes}</p>}
                    </div>
                  ))}
                </Panel>
              )}
            </DeskSection>

            <DeskSection title="Historial del vehículo" id="vehicle-history" actions={<Track><Pill size="sm" disabled={Boolean(busy)} onClick={openHistory}>{detail.history ? <><Pencil /> Editar</> : <><Plus /> Agregar</>}</Pill></Track>}>
              {!detail.history ? <EmptyRow>Sin historial cargado</EmptyRow> : (
                <>
                  <Facts items={[
                    { label: 'Fecha de ingreso', value: formatDate(detail.history.acquisitionDate, timeZone) },
                    { label: 'Origen', value: detail.history.acquisitionSource || '-' },
                    { label: 'Dueños anteriores', value: detail.history.previousOwners ?? '-', mono: true },
                    { label: 'Documentación', value: detail.history.titleStatus || '-' },
                    { label: 'Choques', value: detail.history.hasAccidents ? 'Sí' : 'Sin choques informados' },
                  ]} />
                  {detail.history.hasAccidents && detail.history.accidentDetails && <p className="mt-2 whitespace-pre-line break-words text-sm text-muted-foreground">{detail.history.accidentDetails}</p>}
                  {detail.history.serviceRecords && (
                    <div className="mt-3 border-t pt-3 text-sm">
                      <p className="text-[12px] font-medium text-muted-foreground">Registros de service</p>
                      <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">{detail.history.serviceRecords}</p>
                    </div>
                  )}
                  {detail.history.notes && <p className="mt-2 whitespace-pre-line break-words text-sm text-muted-foreground">{detail.history.notes}</p>}
                </>
              )}
            </DeskSection>
          </div>

          <div className="min-w-0 space-y-8">
            <DeskSection title="Stock" id="vehicle-stock" actions={stock && (
              <Track>
                <Pill size="sm" disabled={!editable || Boolean(busy)} title={editable ? undefined : notEditableReason} onClick={() => openDialog('move', { locationCode: stock.locationCode, locationLabel: stock.locationLabel || '' })}>Mover</Pill>
                <Pill size="sm" disabled={Boolean(busy)} onClick={() => openDialog('cost', { costType: 'reconditioning', amount: '', reference: '' })}>Costo</Pill>
              </Track>
            )}>
              {!stock ? <EmptyRow>Sin stock</EmptyRow> : (
                <Facts items={[
                  { label: 'Ubicación', value: stock.locationLabel && stock.locationLabel !== stock.locationCode ? `${stock.locationLabel} (${stock.locationCode})` : stock.locationCode, mono: true },
                  { label: 'Ingresó', value: formatDate(stock.stockedAt, timeZone) },
                  { label: 'En exhibición', value: stock.frontlineAt ? formatDate(stock.frontlineAt, timeZone) : 'Todavía no' },
                  { label: 'Preparación', value: stock.reconStatus === 'completed' ? 'Done' : stock.reconStatus === 'in-progress' ? 'En curso' : 'Sin iniciar' },
                  { label: 'Publicación', value: merchandisingStatusLabels[stock.merchandisingStatus] || stock.merchandisingStatus },
                  { label: 'Página web', value: listingLive ? 'Publicado' : `No publicado: ${stock.publicListing.reason || 'No disponible'}` },
                  stock.cost && { label: 'Compra', value: money(stock.cost.purchaseCostCents), mono: true },
                  stock.cost && { label: 'Costo de preparación', value: money(stock.cost.reconCostCents), mono: true },
                  stock.cost && { label: 'Otros costos', value: money(stock.cost.otherCostCents), mono: true },
                  stock.cost && { label: 'Costo total', value: money(stock.cost.totalCostCents), mono: true },
                ]} />
              )}
            </DeskSection>

            <DeskSection title="Operación actual" id="vehicle-deal">
              <SectionError section={detail.deals}>
                {!activeDeal ? <EmptyRow>Sin operación abierta</EmptyRow> : (
                  <Panel className="px-4 py-3">
                    <TitleLine tone={activeDeal.status === 'delivered' ? 'ok' : 'info'} status={dealStatusLabels[activeDeal.status]} className="text-sm font-medium">
                      <Link href={`${basePath}/platform/deals/${activeDeal.id}`} className="inline-flex items-center gap-1 hover:underline">
                        {[activeDeal.lead?.firstName, activeDeal.lead?.lastName].filter(Boolean).join(' ') || recordReference('DEAL', activeDeal.id)}
                        <ExternalLink className="size-3" />
                      </Link>
                    </TitleLine>
                    <p className="mt-0.5 flex flex-wrap gap-x-2 pl-4 text-xs text-muted-foreground">
                      <span>{dealStatusLabels[activeDeal.status] || activeDeal.status}</span>
                      {activeDeal.vehiclePriceCents != null && <span>· {money(activeDeal.vehiclePriceCents)}</span>}
                      {activeDeal.salesperson?.name && <span>· {activeDeal.salesperson.name}</span>}
                      <span>· Opened {formatDate(activeDeal.createdAt, timeZone)}</span>
                    </p>
                  </Panel>
                )}
              </SectionError>
            </DeskSection>

            <DeskSection title="Ingreso" id="vehicle-acquisition" actions={<Track><Pill size="sm" variant="plain" asChild><Link href={`${VEHICLES_HREF}/acquisitions`}>Ingresos</Link></Pill></Track>}>
              <SectionError section={detail.acquisition}>
                {!acquisition ? <EmptyRow>Sin registro de ingreso</EmptyRow> : (
                  <>
                    <TitleLine tone={acquisitionStatusTones[acquisition.status]} status={acquisitionStatusLabels[acquisition.status]} className="text-sm font-medium">
                      <Code className="text-foreground">{acquisition.reference}</Code>
                      <span className="font-normal text-muted-foreground"> · {acquisitionStatusLabels[acquisition.status] || acquisition.status}</span>
                    </TitleLine>
                    <Facts className="mt-2" items={[
                      { label: 'Origen', value: acquisitionSourceLabels[acquisition.acquisitionSource] || acquisition.acquisitionSource },
                      Boolean(acquisition.sourceReference) && { label: 'Referencia', value: acquisition.sourceReference, mono: true },
                      { label: 'Tasación', value: money(acquisition.appraisalCents), mono: true },
                      { label: 'Compra', value: money(acquisition.purchaseCents), mono: true },
                      acquisition.reconEstimateCents != null && { label: 'Presupuesto de preparación', value: money(acquisition.reconEstimateCents), mono: true },
                    ]} />
                    {(acquisition.status === 'arrived' || acquisition.status === 'reconditioning') && editable && (
                      <Track className="mt-2">
                        {acquisition.status === 'arrived'
                          ? <Pill size="sm" disabled={Boolean(busy)} onClick={() => advanceAcquisition('reconditioning')}>Enviar a preparación</Pill>
                          : <Pill size="sm" disabled={Boolean(busy) || !reconDone || !listingApproved || Boolean(publicAction)} onClick={() => advanceAcquisition('frontline')}>Pasar a exhibición</Pill>}
                      </Track>
                    )}
                    {acquisition.status === 'reconditioning' && editable && (!reconDone || !listingApproved || Boolean(publicAction)) && (
                      <p className="mt-1 text-xs text-muted-foreground">{!reconDone ? 'Para exhibir, termina la preparación' : 'Para exhibir, aprueba la publicación actual'}</p>
                    )}
                    <ol className="mt-3 space-y-2 border-l pl-4">
                      {acquisition.events.map(event => (
                        <li key={event.id} className="relative text-sm">
                          <span aria-hidden="true" className="absolute -left-[21px] top-1.5 size-2 rounded-[1px] bg-muted-foreground/40" />
                          <p className="font-medium">{event.fromStatus ? `${acquisitionStatusLabels[event.fromStatus] || event.fromStatus} to ${acquisitionStatusLabels[event.toStatus] || event.toStatus}` : acquisitionStatusLabels[event.toStatus] || event.toStatus}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(event.occurredAt, timeZone)} · {personName(event.actor)}</p>
                          <p className="break-words text-xs text-muted-foreground">{event.reason}</p>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </SectionError>
            </DeskSection>

            <DeskSection title="Historial de precios" id="vehicle-prices" count={detail.priceHistory.ok ? detail.priceHistory.data.length : undefined}>
              <SectionError section={detail.priceHistory}>
                {detail.priceHistory.ok && detail.priceHistory.data.length === 0 ? <EmptyRow>Sin cambios de precio</EmptyRow> : detail.priceHistory.ok && (
                  <Panel className="divide-y">
                    {detail.priceHistory.data.map(entry => {
                      const down = entry.previousPriceCents != null && entry.newPriceCents < entry.previousPriceCents
                      return (
                        <div key={entry.id} className="min-w-0 px-4 py-2.5 text-sm">
                          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <span className="tabular-nums">{entry.previousPriceCents == null ? 'Set' : money(entry.previousPriceCents)} to <span className="font-medium text-foreground">{money(entry.newPriceCents)}</span>{down && <span className="text-xs text-muted-foreground"> (rebajado)</span>}</span>
                            <span className="text-xs text-muted-foreground">{formatDateTime(entry.effectiveDate, timeZone)}</span>
                          </p>
                          <p className="break-words text-xs text-muted-foreground">{[entry.changeReason, personName(entry.changedBy)].filter(Boolean).join(' · ')}</p>
                        </div>
                      )
                    })}
                  </Panel>
                )}
              </SectionError>
            </DeskSection>

            <DeskSection title="Movimientos de stock" id="vehicle-ledger" count={detail.stockEvents.ok ? detail.stockEvents.data.length : undefined}>
              <SectionError section={detail.stockEvents}>
                {!stock ? <EmptyRow>Sin stock</EmptyRow> : detail.stockEvents.ok && detail.stockEvents.data.length === 0 ? <EmptyRow>Sin eventos</EmptyRow> : detail.stockEvents.ok && (
                  <Panel className="max-h-[32rem] divide-y overflow-y-auto">
                    {detail.stockEvents.data.map(entry => (
                      <div key={entry.id} className="min-w-0 px-4 py-2.5 text-sm">
                        <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="font-medium">{eventTypeLabel(entry.eventType)}</span>
                          {entry.amountCents != null && <span className="text-xs tabular-nums">{money(entry.amountCents)}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(entry.occurredAt, timeZone)} · {personName(entry.actor)}</p>
                        <p className="break-words text-xs text-muted-foreground">{entry.reason}</p>
                      </div>
                    ))}
                  </Panel>
                )}
              </SectionError>
            </DeskSection>
          </div>
        </div>

        {dialog && config && (
          <InventoryFormDialog
            open
            title={config.title}
            description={`${vehicle.stockNumber} · ${title}`}
            fields={config.fields}
            values={values}
            errors={fieldErrors}
            formError={formError}
            busy={busy === 'dialog'}
            submitLabel={config.submitLabel}
            onValuesChange={setValues}
            onSubmit={submitDialog}
            onOpenChange={open => { if (!open) closeDialog() }}
          />
        )}
      </div>
    </PageContainer>
  )
}
