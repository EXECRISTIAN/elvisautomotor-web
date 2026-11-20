'use client'
import { formatInZone } from '@/features/dashboard/lib/storeTime';

import { useState, useEffect, useRef, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Calculator, Check, Link2, Pencil, Save, Unlink, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import {
  Code,
  DeskHeader,
  DeskSection,
  Facts,
  Figure,
  Meter,
  Notice,
  Panel,
  Pill,
  Segmented,
  Status,
  TitleLine,
  Track,
  type DeskTone,
} from '@/features/platform/components/desk'
import {
  acceptDealWorksheet,
  getAttachableTradeIns,
  getDealLenderOffers,
  getDealWorkspace,
  presentDealWorksheet,
  reopenDealWorksheet,
  saveDealWorksheet,
  selectDealLenderOffer,
  setDealTradeIn,
  transitionDeal,
  type DealLenderOffer,
  type DealTradeIn,
  type DealTradeInOption,
  type DealWorksheetVersion,
} from '../actions'
import { applyDealDefaults, calculateDealPrice, assertValidDealPrice, normalizeMoneyLines, repriceRateTaxLines, sumMoneyLines, type MoneyLine } from '@/features/keystone/lifecycle/dealPricing'
import { WorksheetLines } from '../components/WorksheetLines'
import { FourSquare } from '../components/FourSquare'
import { MoneyInput } from '../components/MoneyInput'
import { readFinanceEvidence, type FinanceEvidence } from '../lib/financeEvidence'
import { FinanceEvidenceHistory } from '../components/FinanceEvidenceHistory'
import { labelForDeal, toneForDeal } from '../lib/dealStatus'
import { formatUsd, formatUsdCredit } from '../lib/formatMoney'
import { OperatorActionDialog } from '@/features/platform/components/OperatorActionDialog'

type LenderOffer = DealLenderOffer

interface Deal {
  id: string
  vehiclePrice: number
  tradeInValue: number
  downPayment: number
  financingAmount: number
  monthlyPayment: number
  loanTerm: number
  apr: number
  taxAmount: number
  status: string
  structureType: string
  worksheetVersion: number
  financeEvidence: FinanceEvidence | null
  form8300Required?: boolean
  fees: MoneyLine[]
  rebates: MoneyLine[]
  products: MoneyLine[]
  taxLines: MoneyLine[]
  residualValueCents: number | null
  moneyFactorBasisPoints: number | null
  presentedAt: string | null
  acceptedAt: string | null
  saleDate: string | null
  createdAt: string
  updatedAt: string
  totalPrice: number
  profit: number | null
  salesperson: { id: string; name: string; email: string } | null
  lead: { id: string; firstName: string; lastName: string; email: string; phone: string } | null
  vehicle: {
    id: string
    year: number
    make: string
    model: string
    trim: string
    stockNumber: string
    vin: string
    exteriorColor: string | null
    condition?: string | null
    price: number
    purchasePrice: number
  } | null
  approvals: {
    id: string
    decision: string
    approvalDate: string
    notes: string
    approver: { name: string } | null
  }[]
}

const fieldLabel = 'text-[12px] font-medium text-muted-foreground'
const inputClass = 'h-10 rounded-[4px] text-right text-[13px] tabular-nums shadow-none'

/** Rate-based tax lines follow the worksheet; the server reprices them the same way on save. */
function withRepricedTax(deal: Deal): Deal {
  try {
    return { ...deal, taxLines: repriceRateTaxLines(deal.taxLines, { vehiclePriceCents: Math.round(deal.vehiclePrice * 100), tradeInValueCents: Math.round(deal.tradeInValue * 100), fees: deal.fees, rebates: deal.rebates }) }
  } catch {
    // Invalid amounts are reported on save; keep the last priced tax until then.
    return deal
  }
}

function lineCents(line: MoneyLine) {
  const value = Number(line.amountCents ?? Math.round(Number((line as { amount?: unknown }).amount || 0) * 100))
  return Number.isFinite(value) ? value : 0
}

const worksheetLineGroups = [
  ['fees', 'Fee'],
  ['products', 'Product'],
  ['rebates', 'Rebate'],
  ['taxLines', 'Tax'],
] as const

/** Field problems the operator can fix before the worksheet is sent to the server. */
function worksheetFieldErrors(deal: Pick<Deal, 'fees' | 'products' | 'rebates' | 'taxLines'>) {
  const errors: string[] = []
  for (const [field, label] of worksheetLineGroups) {
    const missing = deal[field].flatMap((line, index) => String(line.name || '').trim() ? [] : [index + 1])
    if (missing.length === 0) continue
    const lineNote = deal[field].length > 1 ? ` (line ${missing.join(', ')})` : ''
    errors.push(`${label} name is required${lineNote}`)
  }
  return errors
}

/** Lease rate is stored as APR-equivalent basis points; money factor = APR% / 2400. */
function moneyFactorFromBps(bps: number | null | undefined) {
  return (Number(bps) || 0) / 100 / 2400
}

/** Standard lease payment: depreciation plus rent charge on the net capitalized cost. */
function leasePaymentCents(capCostCents: number, residualCents: number, termMonths: number, rateBps: number) {
  if (!termMonths || termMonths < 1) return 0
  const moneyFactor = moneyFactorFromBps(rateBps)
  const depreciation = (capCostCents - residualCents) / termMonths
  const rent = (capCostCents + residualCents) * moneyFactor
  return Math.max(0, Math.round(depreciation + rent))
}

function tradeInName(tradeIn: Pick<DealTradeIn, 'year' | 'make' | 'model' | 'trim'>) {
  return [tradeIn.year, tradeIn.make, tradeIn.model, tradeIn.trim].filter(Boolean).join(' ') || 'Trade-in'
}

const CANCELLABLE_STATUSES = ['pencil', 'approved', 'financed']

/** Only an optimistic-concurrency rejection means someone else changed the deal. */
function isVersionConflict(message: string) {
  return /changed concurrently|reload and retry/i.test(message)
}

/** One row of the deal jacket ledger. */
function LedgerRow({ label, value, emphasis, sub, indent }: { label: ReactNode; value: ReactNode; emphasis?: 'subtotal' | 'total'; sub?: boolean; indent?: boolean }) {
  return (
    <div
      className={[
        'flex min-w-0 items-baseline justify-between gap-4 px-4',
        emphasis === 'total' ? 'border-t border-foreground/60 py-3 text-base font-semibold text-foreground' : emphasis === 'subtotal' ? 'border-t py-2.5 text-sm font-medium text-foreground' : sub ? 'py-1 text-xs text-muted-foreground' : 'py-2 text-sm text-foreground',
        indent ? 'pl-8' : '',
      ].join(' ')}
    >
      <dt className={`min-w-0 break-words ${emphasis || sub ? '' : 'text-muted-foreground'}`}>{label}</dt>
      <dd className="shrink-0 text-right tabular-nums">{value}</dd>
    </div>
  )
}

export function DealDetailPageClient({ id }: { id: string }) {
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [worksheetDirty, setWorksheetDirty] = useState(false)
  const [showLineErrors, setShowLineErrors] = useState(false)
  const [savedPricing, setSavedPricing] = useState<(ReturnType<typeof calculateDealPrice> & { financingAmountCents: number; monthlyPaymentCents: number; apr: number; loanTerm: number }) | null>(null)
  const [lenderOffers, setLenderOffers] = useState<LenderOffer[]>([])
  const [worksheetHistory, setWorksheetHistory] = useState<DealWorksheetVersion[]>([])
  const [acceptanceDialogOpen, setAcceptanceDialogOpen] = useState(false)
  const [acceptanceValues, setAcceptanceValues] = useState({ acknowledgment: '' })
  const [acceptanceError, setAcceptanceError] = useState<string | null>(null)
  const acceptanceIdempotencyKeyRef = useRef<string | null>(null)
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false)
  const [reopenValues, setReopenValues] = useState({ reason: '' })
  const [reopenError, setReopenError] = useState<string | null>(null)
  const reopenIdempotencyKeyRef = useRef<string | null>(null)
  const [approvalIntent, setApprovalIntent] = useState<{ toStatus: string; notes: string; idempotencyKey: string; title: string; submitLabel: string } | null>(null)
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelValues, setCancelValues] = useState({ reason: '' })
  const [cancelError, setCancelError] = useState<string | null>(null)
  const cancelIdempotencyKeyRef = useRef<string | null>(null)
  const [dealTradeIn, setDealTradeInRecord] = useState<DealTradeIn | null>(null)
  const [dealRooftopId, setDealRooftopId] = useState<string | null>(null)
  const [tradeInDialog, setTradeInDialog] = useState<'attach' | 'detach' | null>(null)
  const [tradeInOptions, setTradeInOptions] = useState<DealTradeInOption[] | null>(null)
  const [tradeInValues, setTradeInValues] = useState({ tradeInId: '', reason: '' })
  const [tradeInError, setTradeInError] = useState<string | null>(null)
  const tradeInIdempotencyKeyRef = useRef<string | null>(null)

  useEffect(() => {
    loadDeal()
  }, [id])

  const loadDeal = async () => {
    setLoading(true)
    setError(null)
    const response = await getDealWorkspace(id)
    if (response.success && response.data?.dealWorkspace?.deal) {
      const value = response.data.dealWorkspace.deal
      setDealTradeInRecord(response.data.tradeIn)
      setDealRooftopId(response.data.rooftopId)
      value.form8300Required = value.financeEvidence?.payment?.form8300Required === true
      value.financeEvidence = readFinanceEvidence(value.financeEvidence)
      for (const key of ['fees', 'rebates', 'products', 'taxLines']) value[key] = Array.isArray(value[key]) ? value[key] : []
      if (!value.taxLines.length && value.taxAmountCents > 0) value.taxLines = [{ code: 'legacy-tax', name: 'Tax', amountCents: value.taxAmountCents, source: 'operator-recorded' }]
      setShowLineErrors(false)
      setWorksheetHistory(response.data.dealWorkspace.worksheetVersions || [])
      setSavedPricing({ ...calculateDealPrice(value), financingAmountCents: value.financingAmountCents || 0, monthlyPaymentCents: value.monthlyPaymentCents || 0, apr: value.apr || 0, loanTerm: value.loanTerm || 0 })
      // A never-saved pencil with no fee or tax lines starts from the store's doc fee and tax rate.
      let prefilled = false
      if (value.status === 'pencil' && !value.worksheetVersion) {
        try {
          const seeded = applyDealDefaults(value, response.data.dealDefaults)
          if (seeded.changed) {
            value.fees = seeded.fees
            value.taxLines = seeded.taxLines
            prefilled = true
          }
        } catch {
          prefilled = false
        }
      }
      setWorksheetDirty(prefilled)
      const dollars = (cents: number | null | undefined) => (cents ?? 0) / 100
      setDeal({ ...value, vehiclePrice: dollars(value.vehiclePriceCents), tradeInValue: dollars(value.tradeInValueCents), downPayment: dollars(value.downPaymentCents), financingAmount: dollars(value.financingAmountCents), monthlyPayment: dollars(value.monthlyPaymentCents), taxAmount: dollars(value.taxAmountCents), totalPrice: dollars(value.totalPriceCents), profit: null, salesperson: value.salesperson ? { ...value.salesperson, email: '' } : null, lead: value.lead ? { ...value.lead, email: '', phone: '' } : null, vehicle: value.vehicle ? { ...value.vehicle, price: dollars(value.vehicle.priceCents), purchasePrice: 0 } : null })
      const offers = await getDealLenderOffers(id)
      setLenderOffers(offers.success ? offers.data?.dealLenderOffers || [] : [])
    } else {
      setDeal(null)
      setError(response.error || 'No se encontró la operación.')
    }
    setLoading(false)
  }

  const editWorksheet = (patch: Partial<Deal>) => {
    setWorksheetDirty(true)
    setDeal(current => current ? withRepricedTax({ ...current, ...patch }) : current)
  }

  const saveWorksheetVersion = async () => {
    if (!deal) return
    setError(null)
    const fieldErrors = worksheetFieldErrors(deal)
    if (fieldErrors.length) {
      setShowLineErrors(true)
      setError(fieldErrors.join('. '))
      return
    }
    let lines: { fees: MoneyLine[]; rebates: MoneyLine[]; products: MoneyLine[]; taxLines: MoneyLine[] }
    const amounts = { vehiclePriceCents: Math.round(deal.vehiclePrice * 100), tradeInValueCents: Math.round(deal.tradeInValue * 100), downPaymentCents: Math.round(deal.downPayment * 100) }
    try {
      lines = { fees: normalizeMoneyLines(deal.fees, 'Fee'), rebates: normalizeMoneyLines(deal.rebates, 'Rebate'), products: normalizeMoneyLines(deal.products, 'Product'), taxLines: normalizeMoneyLines(deal.taxLines, 'Tax') }
      assertValidDealPrice(calculateDealPrice({ ...amounts, ...lines, taxAmountCents: sumMoneyLines(lines.taxLines) }))
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Revisa los montos de la hoja')
      return
    }
    setUpdating(true)
    try {
      const response = await saveDealWorksheet({
        dealId: deal.id,
        structureType: deal.structureType,
        ...amounts,
        ...lines,
        monthlyPaymentCents: Math.round(deal.monthlyPayment * 100),
        loanTerm: deal.structureType === 'cash' ? null : deal.loanTerm,
        apr: deal.structureType === 'finance' ? deal.apr : null,
        residualValueCents: deal.structureType === 'lease' ? deal.residualValueCents : null,
        moneyFactorBasisPoints: deal.structureType === 'lease' ? deal.moneyFactorBasisPoints : null,
        expectedUpdatedAt: deal.updatedAt,
        reason: 'Guardada desde la operación antes de presentarla.',
        idempotencyKey: `deal-worksheet:${deal.id}:${deal.updatedAt}`,
      })
      if (!response.success) throw new Error(response.error || 'Worksheet save failed')
      await loadDeal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Worksheet save failed'
      setError(isVersionConflict(message)
        ? 'Otra persona cambió esta operación mientras la tenías abierta. Tus cambios no se perdieron: cópialos antes de recargar.'
        : `Worksheet not saved: ${message}`)
    } finally {
      setUpdating(false)
    }
  }

  const recordWorksheetDecision = async (action: 'present' | 'accept') => {
    if (!deal) return
    if (action === 'accept') {
      setAcceptanceValues({ acknowledgment: '' })
      setAcceptanceError(null)
      acceptanceIdempotencyKeyRef.current = `deal-accept:${deal.id}:${crypto.randomUUID()}`
      setAcceptanceDialogOpen(true)
      return
    }

    setUpdating(true)
    setError(null)
    const response = await presentDealWorksheet({
      dealId: deal.id,
      expectedUpdatedAt: deal.updatedAt,
      idempotencyKey: `deal-present:${deal.id}:${deal.worksheetVersion}:${deal.updatedAt}`,
    })
    if (!response.success) setError(`Unable to ${action} worksheet: ${response.error}`)
    await loadDeal()
    setUpdating(false)
  }

  const submitWorksheetAcceptance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!deal) return
    const acknowledgment = acceptanceValues.acknowledgment.trim()
    const idempotencyKey = acceptanceIdempotencyKeyRef.current
    if (!acknowledgment) {
      setAcceptanceError('Indica la forma de aceptación o una referencia.')
      return
    }
    if (!idempotencyKey) {
      setAcceptanceError('Cierra y vuelve a abrir esta ventana para reintentar.')
      return
    }

    setUpdating(true)
    setAcceptanceError(null)
    try {
      const response = await acceptDealWorksheet({ dealId: deal.id, expectedUpdatedAt: deal.updatedAt, acknowledgment, idempotencyKey })
      if (!response.success) {
        setAcceptanceError(`Unable to record worksheet acceptance: ${response.error}`)
        return
      }

      acceptanceIdempotencyKeyRef.current = null
      setAcceptanceDialogOpen(false)
      await loadDeal()
    } catch (error) {
      setAcceptanceError(`Unable to record worksheet acceptance: ${error instanceof Error ? error.message : 'Request failed'}`)
    } finally {
      setUpdating(false)
    }
  }

  const handleAcceptanceDialogOpenChange = (open: boolean) => {
    setAcceptanceDialogOpen(open)
    if (!open) {
      acceptanceIdempotencyKeyRef.current = null
      setAcceptanceValues({ acknowledgment: '' })
      setAcceptanceError(null)
    }
  }

  const selectLenderOffer = async (lenderDecisionId: string) => {
    if (!deal) return
    setUpdating(true)
    setError(null)
    const response = await selectDealLenderOffer({
      dealId: deal.id,
      lenderDecisionId,
      expectedUpdatedAt: deal.updatedAt,
      idempotencyKey: `deal-lender:${deal.id}:${lenderDecisionId}:${deal.worksheetVersion}:${deal.updatedAt}`,
    })
    if (!response.success) setError(`Unable to select lender offer: ${response.error}`)
    await loadDeal()
    setUpdating(false)
  }

  const reopenWorksheet = () => {
    if (!deal) return
    setReopenValues({ reason: '' })
    setReopenError(null)
    reopenIdempotencyKeyRef.current = `deal-reopen:${deal.id}:${crypto.randomUUID()}`
    setReopenDialogOpen(true)
  }

  const submitReopenWorksheet = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!deal) return
    const reason = reopenValues.reason.trim()
    const idempotencyKey = reopenIdempotencyKeyRef.current
    if (!reason) {
      setReopenError('A reason is required to reopen the worksheet.')
      return
    }
    if (reason.length > 1000) {
      setReopenError('The reopen reason must be 1,000 characters or fewer.')
      return
    }
    if (!idempotencyKey) {
      setReopenError('Cierra y vuelve a abrir esta ventana para reintentar.')
      return
    }

    setUpdating(true)
    setReopenError(null)
    try {
      const response = await reopenDealWorksheet({ dealId: deal.id, expectedUpdatedAt: deal.updatedAt, reason, idempotencyKey })
      if (!response.success) {
        setReopenError(`Unable to reopen worksheet: ${response.error || 'Request failed'}`)
        return
      }

      await loadDeal()
      reopenIdempotencyKeyRef.current = null
      setReopenDialogOpen(false)
    } catch (error) {
      setReopenError(`Unable to reopen worksheet: ${error instanceof Error ? error.message : 'Request failed'}`)
    } finally {
      setUpdating(false)
    }
  }

  const handleReopenDialogOpenChange = (open: boolean) => {
    setReopenDialogOpen(open)
    if (!open) {
      reopenIdempotencyKeyRef.current = null
      setReopenValues({ reason: '' })
      setReopenError(null)
    }
  }

  const transitionDealStatus = async (newStatus: string, notes: string, idempotencyKey: string) => {
    setUpdating(true)
    try {
      const response = await transitionDeal({ id, toStatus: newStatus, notes, idempotencyKey })
      if (!response.success) return `Failed to update deal: ${response.error || 'Request failed'}`
      await loadDeal()
      return null
    } catch (error) {
      return `Failed to update deal: ${error instanceof Error ? error.message : 'Request failed'}`
    } finally {
      setUpdating(false)
    }
  }

  const updateStatus = async (newStatus: string, approvalDecision?: 'pending' | 'approved' | 'rejected' | 'changes-requested') => {
    const defaultNote = approvalDecision === 'pending'
      ? 'Enviada a aprobación desde la página de la operación.'
      : approvalDecision === 'approved'
        ? 'Aprobada desde la página de la operación.'
        : approvalDecision === 'rejected'
          ? 'Rechazada desde la página de la operación.'
          : ''

    if (approvalDecision) {
      const title = approvalDecision === 'pending'
        ? 'Enviar a aprobación'
        : approvalDecision === 'approved'
          ? 'Approve deal'
          : approvalDecision === 'rejected'
            ? 'Reject deal'
            : 'Update deal approval'
      setApprovalError(null)
      setApprovalIntent({
        toStatus: newStatus,
        notes: defaultNote,
        idempotencyKey: `deal-transition:${id}:${newStatus}:${deal?.worksheetVersion}:${deal?.updatedAt}`,
        title,
        submitLabel: title,
      })
      return
    }

    setError(null)
    const failure = await transitionDealStatus(newStatus, '', `deal-transition:${id}:${newStatus}:${deal?.worksheetVersion}:${deal?.updatedAt}`)
    if (failure) setError(failure)
  }

  const submitApprovalNotes = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const intent = approvalIntent
    if (!intent) return
    setApprovalError(null)
    const failure = await transitionDealStatus(intent.toStatus, intent.notes, intent.idempotencyKey)
    if (failure) {
      setApprovalError(failure)
      return
    }
    setApprovalIntent(null)
  }

  const handleApprovalNotesOpenChange = (open: boolean) => {
    if (open) return
    setApprovalIntent(null)
    setApprovalError(null)
  }

  const openCancelDeal = () => {
    setCancelValues({ reason: '' })
    setCancelError(null)
    cancelIdempotencyKeyRef.current = `deal-cancel:${id}:${crypto.randomUUID()}`
    setCancelDialogOpen(true)
  }

  const submitCancelDeal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const reason = cancelValues.reason.trim()
    if (!reason) {
      setCancelError('A cancellation reason is required.')
      return
    }
    if (!cancelIdempotencyKeyRef.current) {
      setCancelError('Cierra y vuelve a abrir esta ventana para reintentar.')
      return
    }
    setCancelError(null)
    const failure = await transitionDealStatus('cancelled', reason, cancelIdempotencyKeyRef.current)
    if (failure) {
      setCancelError(failure)
      return
    }
    cancelIdempotencyKeyRef.current = null
    setCancelDialogOpen(false)
  }

  const openTradeInDialog = async (kind: 'attach' | 'detach') => {
    if (!deal) return
    setTradeInError(null)
    setTradeInValues({ tradeInId: '', reason: '' })
    tradeInIdempotencyKeyRef.current = `deal-trade-in:${deal.id}:${crypto.randomUUID()}`
    setTradeInDialog(kind)
    if (kind === 'attach') {
      setTradeInOptions(null)
      if (!dealRooftopId) {
        setTradeInOptions([])
        return
      }
      const response = await getAttachableTradeIns(dealRooftopId, deal.lead?.id || null)
      if (response.success) setTradeInOptions(response.data.tradeIns)
      else {
        setTradeInOptions([])
        setTradeInError(response.error || 'No se pudieron cargar los usados.')
      }
    }
  }

  const submitTradeIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!deal || !tradeInDialog) return
    const tradeInId = tradeInDialog === 'attach' ? tradeInValues.tradeInId : null
    const reason = tradeInValues.reason.trim()
    if (tradeInDialog === 'attach' && !tradeInId) return setTradeInError('Elige un usado.')
    if (tradeInDialog === 'detach' && !reason) return setTradeInError('A reason is required.')
    if (!tradeInIdempotencyKeyRef.current) return setTradeInError('Cierra y vuelve a abrir esta ventana para reintentar.')
    setUpdating(true)
    setTradeInError(null)
    try {
      const response = await setDealTradeIn({ dealId: deal.id, tradeInId, expectedUpdatedAt: deal.updatedAt, reason: reason || undefined, idempotencyKey: tradeInIdempotencyKeyRef.current })
      if (!response.success) {
        setTradeInError(response.error)
        return
      }
      tradeInIdempotencyKeyRef.current = null
      setTradeInDialog(null)
      await loadDeal()
    } finally {
      setUpdating(false)
    }
  }

  const formatCurrency = (value: number | null | undefined) => formatUsd(value)

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return formatInZone(date, undefined, "datetime")
  }

  const breadcrumbs = (label: string) => [
    { type: 'link' as const, label: 'Inicio', href: basePath },
    { type: 'page' as const, label: 'Gestión' },
    { type: 'link' as const, label: 'Operaciones', href: `${basePath}/platform/deals` },
    { type: 'page' as const, label },
  ]

  if (loading && !deal) {
    return (
      <PageContainer title="Operación" header={<DeskHeader title="Cargando operación" meta="Deal" />} breadcrumbs={breadcrumbs('Deal')}>
        <div className="flex min-h-[320px] items-center justify-center px-4 md:px-6" role="status">
          <span className="text-sm text-muted-foreground">Cargando operación</span>
        </div>
      </PageContainer>
    )
  }

  if (!deal) {
    return (
      <PageContainer
        title="Operación"
        header={
          <DeskHeader
            title="Operación no disponible"
            meta="The deal could not be loaded"
            actions={
              <Track>
                <Pill asChild>
                  <Link href={`${basePath}/platform/deals`}>Volver a operaciones</Link>
                </Pill>
              </Track>
            }
          />
        }
        breadcrumbs={breadcrumbs('Deal')}
      >
        <div className="px-4 pb-24 md:px-6">
          <Notice tone="bad">{error || 'No se encontró la operación.'}</Notice>
        </div>
      </PageContainer>
    )
  }

  const dealChecklist = [
    { label: 'Consulta del cliente vinculada', complete: Boolean(deal.lead), detail: deal.lead ? `${deal.lead.firstName} ${deal.lead.lastName}` : 'Attach customer before contracting' },
    { label: 'Vehículo elegido', complete: Boolean(deal.vehicle), detail: deal.vehicle ? `${deal.vehicle.stockNumber} · ${deal.vehicle.vin}` : 'Vincular vehículo y chasis' },
    { label: 'Precio negociado cargado', complete: Number(deal.vehiclePrice || 0) > 0, detail: formatCurrency(deal.vehiclePrice) },
    { label: 'Estructura completa', complete: deal.structureType === 'cash' ? deal.worksheetVersion > 0 : Number(deal.financingAmount || 0) > 0 && Number(deal.loanTerm || 0) > 0 && Number(deal.monthlyPayment || 0) > 0, detail: deal.structureType === 'cash' ? 'Cash structure' : `${formatCurrency(deal.financingAmount)} · ${deal.loanTerm || '-'} mo · ${formatCurrency(deal.monthlyPayment)}/mo` },
    { label: 'Anticipo previsto', complete: deal.structureType === 'cash' || Number(deal.downPayment || 0) > 0, detail: deal.structureType === 'cash' ? `${formatCurrency(deal.downPayment)} · cash deal, full total due at signing` : formatCurrency(deal.downPayment) },
    { label: 'Impuesto ahorrado', complete: deal.worksheetVersion > 0, detail: formatCurrency(deal.taxAmount) },
    { label: 'Aprobación del gerente registrada', complete: deal.approvals?.some(approval => approval.decision === 'approved'), detail: `${deal.approvals?.length || 0} approval event(s)` },
    { label: 'Entrega marcada como completa', complete: deal.status === 'delivered', detail: deal.saleDate ? formatDate(deal.saleDate) : 'Not delivered' },
  ]
  const checklistComplete = dealChecklist.filter(item => item.complete).length

  const isCash = deal.structureType !== 'finance' && deal.structureType !== 'lease'
  const worksheetSaved = deal.worksheetVersion > 0
  // Server math: a cash structure finances nothing, so the whole total is due at signing and the
  // down payment is a part of it, not a deduction. Finance: amount financed = total - down payment.
  const downPaymentLabel = isCash ? 'Anticipo (parte del monto a pagar)' : 'Planned down payment'

  const dealTitle = deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : 'Deal'
  const customerName = deal.lead ? `${deal.lead.firstName} ${deal.lead.lastName}` : 'No customer'
  const statusLabel = labelForDeal(deal.status)
  const finance = deal.financeEvidence

  // The one next step a desk manager takes from pencil; it renders as the primary pill.
  const pencilNext = worksheetDirty || deal.worksheetVersion === 0
    ? 'save'
    : !deal.presentedAt
      ? 'present'
      : !deal.acceptedAt
        ? 'accept'
        : 'submit'

  const statusActions = (
    <Track aria-label="Acciones de la operación">
      {deal.status === 'pencil' && (
        <>
          <Pill variant={pencilNext === 'save' ? 'primary' : 'raised'} onClick={saveWorksheetVersion} disabled={updating}>
            <Save />
            Guardar versión de la hoja
          </Pill>
          {deal.worksheetVersion > 0 && !deal.presentedAt && <Pill variant={pencilNext === 'present' ? 'primary' : 'raised'} onClick={() => recordWorksheetDecision('present')} disabled={updating || worksheetDirty}>Presentar estructura</Pill>}
          {deal.presentedAt && !deal.acceptedAt && <Pill variant={pencilNext === 'accept' ? 'primary' : 'raised'} onClick={() => recordWorksheetDecision('accept')} disabled={updating || worksheetDirty}>Registrar aceptación</Pill>}
          {deal.acceptedAt && <Pill variant={pencilNext === 'submit' ? 'primary' : 'raised'} onClick={() => updateStatus('submitted', 'pending')} disabled={updating || worksheetDirty}>Enviar a aprobación</Pill>}
        </>
      )}
      {deal.status === 'submitted' && (
        <>
          <Pill variant="primary" onClick={() => updateStatus('approved', 'approved')} disabled={updating}>
            <Check />
            Aprobar
          </Pill>
          <Pill variant="danger" onClick={() => updateStatus('cancelled', 'rejected')} disabled={updating}>
            <X />
            Rechazar
          </Pill>
        </>
      )}
      {['submitted', 'approved'].includes(deal.status) && (
        <Pill onClick={reopenWorksheet} disabled={updating}>
          <Pencil />
          Reabrir hoja
        </Pill>
      )}
      {deal.status === 'approved' && (
        <Pill asChild variant="primary">
          <Link href={`${basePath}/platform/finance`}>
            Abrir financiación
            <ArrowRight />
          </Link>
        </Pill>
      )}
      {deal.status === 'financed' && (
        <Pill asChild variant="primary">
          <Link href={`${basePath}/platform/delivery`}>
            Abrir entrega
            <ArrowRight />
          </Link>
        </Pill>
      )}
      {CANCELLABLE_STATUSES.includes(deal.status) && (
        <Pill onClick={openCancelDeal} disabled={updating}>
          <X />
          Cancelar operación
        </Pill>
      )}
    </Track>
  )
  const hasStatusActions = ['pencil', 'submitted', 'approved', 'financed'].includes(deal.status)

  // The deal's stage said in words: where it is and what it is waiting on.
  const stageLine = deal.status === 'pencil'
    ? pencilNext === 'save'
      ? worksheetDirty && deal.worksheetVersion > 0 ? 'worksheet has unsaved changes' : 'worksheet not saved yet'
      : pencilNext === 'present'
        ? 'ready to present to the customer'
        : pencilNext === 'accept'
          ? 'presented, waiting on customer acceptance'
          : 'accepted, ready to submit to the desk'
    : deal.status === 'submitted'
      ? 'waiting on desk approval'
      : deal.status === 'approved'
        ? 'approved, waiting on F&I'
        : deal.status === 'financed'
          ? 'financed, waiting on delivery'
          : deal.status === 'delivered'
            ? deal.saleDate ? `delivered ${formatDate(deal.saleDate)}` : 'delivered'
            : deal.status === 'cancelled'
              ? 'closed as cancelled'
              : ''

  const header = (
    <DeskHeader
      title={dealTitle}
      status={statusLabel}
      meta={
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <Status tone={toneForDeal(deal.status)}>{statusLabel}</Status>
          {stageLine && <span className="text-foreground">{stageLine}</span>}
          <span>· {customerName}</span>
          <span>· {deal.salesperson?.name || 'Unassigned'}</span>
          {deal.vehicle && <Code>#{deal.vehicle.stockNumber}</Code>}
          <span>· Opened {formatDate(deal.createdAt)}</span>
        </span>
      }
      actions={hasStatusActions ? statusActions : undefined}
    />
  )

  const lineGroups = ([
    ['fees', 'Fees', 'feesCents', 1],
    ['products', 'Products', 'productsCents', 1],
    ['rebates', 'Rebates', 'rebatesCents', -1],
  ] as const)

  const offerTone = (offer: LenderOffer): DeskTone => (offer.selected && finance?.selectedOfferCurrent ? 'ok' : offer.selected ? 'warn' : offer.decision === 'approved' ? 'info' : 'idle')

  return (
    <PageContainer title={dealTitle} header={header} breadcrumbs={breadcrumbs(dealTitle)}>
      <div className="min-w-0 max-w-full space-y-8 px-4 pb-24 md:px-6">
        {(error || worksheetDirty || deal.form8300Required) && (
          <div className="space-y-2">
            {error && <Notice tone="bad">{error}</Notice>}
            {worksheetDirty && <Notice tone="warn" role="status">Cambios sin guardar en la hoja</Notice>}
            {deal.form8300Required && <Notice tone="warn" role="status">Cash over $10,000: IRS Form 8300 required</Notice>}
          </div>
        )}

        {savedPricing && (
          <FourSquare
            cells={[
              { label: 'Precio del vehículo', value: formatCurrency(savedPricing.vehiclePriceCents / 100), sub: deal.vehicle ? `${deal.vehicle.condition === 'new' ? 'MSRP' : 'Asking'} ${formatCurrency(deal.vehicle.price)}` : undefined },
              { label: 'Usado', value: formatUsdCredit(savedPricing.tradeInValueCents / 100), sub: dealTradeIn ? tradeInName(dealTradeIn) : 'No trade' },
              { label: isCash ? 'Anticipo (parte del monto a pagar)' : 'Down payment', value: formatCurrency(savedPricing.downPaymentCents / 100) },
              savedPricing.loanTerm > 0
                ? { label: 'Pago', value: `${formatCurrency(savedPricing.monthlyPaymentCents / 100)}/mo`, sub: deal.structureType === 'lease' ? `Lease · ${savedPricing.loanTerm} mo` : `${savedPricing.apr}% APR · ${savedPricing.loanTerm} mo` }
                : { label: 'Monto financiado', value: formatCurrency(savedPricing.financingAmountCents / 100), sub: deal.structureType === 'cash' ? 'Cash' : undefined },
            ]}
            footer={
              <>
                <span className="flex items-baseline gap-2">
                  <span className="text-muted-foreground">Precio total</span>
                  <Figure size="sm">{formatCurrency(savedPricing.totalPriceCents / 100)}</Figure>
                  <span className="text-xs text-muted-foreground">{worksheetSaved ? `v${deal.worksheetVersion}` : 'Not saved'}</span>
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="text-muted-foreground">A pagar en la firma</span>
                  <Figure size="sm">{formatCurrency(savedPricing.cashPayableCents / 100)}</Figure>
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="text-muted-foreground">Legajo de la operación</span>
                  <span className="tabular-nums text-foreground">{checklistComplete}/{dealChecklist.length}</span>
                  <span className="text-xs text-muted-foreground">{checklistComplete === dealChecklist.length ? 'Listo' : 'Incompleto'}</span>
                </span>
              </>
            }
          />
        )}

        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-8">
            <DeskSection
              title="Legajo de la operación"
              actions={<span className="text-[12px] text-muted-foreground">{worksheetSaved ? `Saved v${deal.worksheetVersion}` : 'Unsaved'}</span>}
            >
              {savedPricing ? (
                <Panel className="overflow-hidden">
                  <dl className="divide-y divide-border/60">
                    <LedgerRow label="Precio del vehículo" value={formatCurrency(savedPricing.vehiclePriceCents / 100)} />
                    {lineGroups.map(([field, title, key, sign]) => (
                      <div key={field}>
                        <LedgerRow label={title} value={sign < 0 ? formatUsdCredit(savedPricing[key] / 100) : formatCurrency(savedPricing[key] / 100)} />
                        {!worksheetDirty && deal[field].map((line, index) => (
                          <LedgerRow key={`${field}-${index}`} sub indent label={line.name || line.code} value={sign < 0 ? formatUsdCredit(lineCents(line) / 100) : formatCurrency(lineCents(line) / 100)} />
                        ))}
                      </div>
                    ))}
                    <LedgerRow emphasis="subtotal" label="Subtotal antes de impuestos / usado" value={formatCurrency(savedPricing.subtotalCents / 100)} />
                    <div>
                      <LedgerRow label="Impuestos" value={formatCurrency(savedPricing.taxAmountCents / 100)} />
                      {!worksheetDirty && deal.taxLines.map((line, index) => (
                        <LedgerRow key={`tax-${index}`} sub indent label={line.name || line.code} value={formatCurrency(lineCents(line) / 100)} />
                      ))}
                    </div>
                    <LedgerRow label="Crédito por usado" value={formatUsdCredit(savedPricing.tradeInValueCents / 100)} />
                    <LedgerRow emphasis="total" label="Precio total" value={formatCurrency(savedPricing.totalPriceCents / 100)} />
                    {isCash ? (
                      <LedgerRow sub indent label={downPaymentLabel} value={formatCurrency(savedPricing.downPaymentCents / 100)} />
                    ) : (
                      <>
                        <LedgerRow label={downPaymentLabel} value={formatCurrency(savedPricing.downPaymentCents / 100)} />
                        <LedgerRow label="Monto financiado" value={formatCurrency(savedPricing.financingAmountCents / 100)} />
                      </>
                    )}
                    <LedgerRow emphasis="subtotal" label="Contado · a pagar en la firma" value={formatCurrency(savedPricing.cashPayableCents / 100)} />
                  </dl>
                  {(savedPricing.loanTerm > 0 || deal.saleDate) && (
                    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t bg-muted/40 px-4 py-3">
                      {savedPricing.loanTerm > 0 && (
                        <>
                          <span className="text-xs text-muted-foreground">{deal.structureType === 'lease' ? `Lease · residual ${formatCurrency((deal.residualValueCents || 0) / 100)} · money factor ${moneyFactorFromBps(deal.moneyFactorBasisPoints).toFixed(5)}` : `${savedPricing.apr}% APR`} · {savedPricing.loanTerm} months · estimated payment</span>
                          <Figure>{formatCurrency(savedPricing.monthlyPaymentCents / 100)}/mo</Figure>
                        </>
                      )}
                      {deal.saleDate && <span className="w-full text-xs text-muted-foreground">Sale completed {formatDate(deal.saleDate)}</span>}
                    </div>
                  )}
                </Panel>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin hoja guardada</p>
              )}
            </DeskSection>

            {deal.status === 'pencil' && (
              <DeskSection title="Condiciones de la hoja">
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <p className={fieldLabel}>Estructura</p>
                    <Segmented
                      label="Estructura de la operación"
                      size="sm"
                      value={deal.structureType === 'finance' || deal.structureType === 'lease' ? deal.structureType : 'cash'}
                      onChange={(structureType) => editWorksheet({
                        structureType,
                        ...(structureType === 'cash' ? { loanTerm: 0, apr: 0, financingAmount: 0, monthlyPayment: 0, residualValueCents: null, moneyFactorBasisPoints: null } : {}),
                        ...(structureType === 'finance' ? { residualValueCents: null, moneyFactorBasisPoints: null } : {}),
                        ...(structureType === 'lease' ? { apr: 0, residualValueCents: deal.residualValueCents ?? 0, moneyFactorBasisPoints: deal.moneyFactorBasisPoints ?? 0 } : {}),
                      })}
                      options={[{ value: 'cash', label: 'Contado', disabled: updating }, { value: 'finance', label: 'Solicitudes de crédito', disabled: updating }, { value: 'lease', label: 'Leasing', disabled: updating }]}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {([
                      ['Negotiated vehicle price', 'vehiclePrice'],
                      ['Trade-in credit', 'tradeInValue'],
                      [isCash ? 'Anticipo (parte del monto a pagar)' : 'Down payment', 'downPayment'],
                    ] as const).map(([label, field]) => (
                      <label key={field} className="grid min-w-0 gap-1.5">
                        <span className={fieldLabel}>{label}</span>
                        <MoneyInput disabled={updating} aria-label={label} className="h-10 text-[13px]" cents={Math.round(Number(deal[field] || 0) * 100)} onCentsChange={(cents) => editWorksheet({ [field]: cents / 100 })} />
                      </label>
                    ))}
                    {deal.structureType === 'finance' && (
                      <>
                        <label className="grid min-w-0 gap-1.5"><span className={fieldLabel}>APR (%)</span><Input disabled={updating} aria-label="Tasa anual (%)" className={inputClass} type="number" min="0" max="100" step="0.01" value={deal.apr || 0} onChange={(event) => editWorksheet({ apr: Number(event.target.value) })} /></label>
                        <label className="grid min-w-0 gap-1.5"><span className={fieldLabel}>Term (months)</span><Input disabled={updating} aria-label="Plazo en meses" className={inputClass} type="number" min="1" max="120" step="1" value={deal.loanTerm || 0} onChange={(event) => editWorksheet({ loanTerm: Number(event.target.value) })} /></label>
                      </>
                    )}
                    {deal.structureType === 'lease' && (
                      <>
                        <label className="grid min-w-0 gap-1.5"><span className={fieldLabel}>Term (months)</span><Input disabled={updating} aria-label="Plazo del leasing en meses" className={inputClass} type="number" min="1" max="120" step="1" value={deal.loanTerm || 0} onChange={(event) => editWorksheet({ loanTerm: Number(event.target.value) })} /></label>
                        <label className="grid min-w-0 gap-1.5"><span className={fieldLabel}>Valor residual</span><MoneyInput disabled={updating} aria-label="Valor residual" className="h-10 text-[13px]" cents={deal.residualValueCents || 0} onCentsChange={(cents) => editWorksheet({ residualValueCents: cents })} /></label>
                        <label className="grid min-w-0 gap-1.5">
                          <span className={fieldLabel}>Lease rate (APR %)</span>
                          <Input disabled={updating} aria-label="Tasa del leasing (% anual)" aria-describedby="lease-money-factor" className={inputClass} type="number" min="0" max="100" step="0.01" value={(deal.moneyFactorBasisPoints || 0) / 100} onChange={(event) => editWorksheet({ moneyFactorBasisPoints: Math.max(0, Math.round(Number(event.target.value) * 100)) })} />
                          <span id="lease-money-factor" className="text-xs tabular-nums text-muted-foreground">Money factor {moneyFactorFromBps(deal.moneyFactorBasisPoints).toFixed(5)}</span>
                        </label>
                        <label className="grid min-w-0 gap-1.5">
                          <span className={fieldLabel}>Cuota mensual</span>
                          <MoneyInput disabled={updating} aria-label="Cuota mensual del leasing" className="h-10 text-[13px]" cents={Math.round(Number(deal.monthlyPayment || 0) * 100)} onCentsChange={(cents) => editWorksheet({ monthlyPayment: cents / 100 })} />
                        </label>
                        <div className="flex items-end">
                          <Track>
                            <Pill
                              size="sm"
                              disabled={updating || !deal.loanTerm}
                              onClick={() => {
                                try {
                                  const lines = { fees: deal.fees, rebates: deal.rebates, products: deal.products, taxLines: deal.taxLines }
                                  const price = calculateDealPrice({ vehiclePriceCents: Math.round(deal.vehiclePrice * 100), tradeInValueCents: Math.round(deal.tradeInValue * 100), downPaymentCents: Math.round(deal.downPayment * 100), ...lines, taxAmountCents: sumMoneyLines(deal.taxLines) })
                                  editWorksheet({ monthlyPayment: leasePaymentCents(Math.max(0, price.balanceCents), deal.residualValueCents || 0, deal.loanTerm, deal.moneyFactorBasisPoints || 0) / 100 })
                                } catch {
                                  setError('Revisa los montos de la hoja')
                                }
                              }}
                            >
                              <Calculator />
                              Calcular cuota
                            </Pill>
                          </Track>
                        </div>
                      </>
                    )}
                  </div>
                  <Panel className="space-y-3 p-3">
                    {([['fees', 'Fees', 'fee'], ['products', 'Products', 'product'], ['rebates', 'Rebates', 'rebate'], ['taxLines', 'Tax', 'tax']] as const).map(([field, title, category]) => <WorksheetLines key={field} title={title} category={category} lines={deal[field]} disabled={updating} showErrors={showLineErrors} onChange={lines => editWorksheet({ [field]: lines })} />)}
                  </Panel>
                  <Track>
                    <Pill variant={worksheetDirty ? 'primary' : 'raised'} onClick={saveWorksheetVersion} disabled={updating}>
                      <Save />
                      Guardar versión de la hoja
                    </Pill>
                  </Track>
                </div>
              </DeskSection>
            )}

            {deal.structureType !== 'cash' && (
              <DeskSection title={worksheetSaved ? `Lender offers · worksheet ${deal.worksheetVersion}` : 'Lender offers · unsaved worksheet'} count={lenderOffers.length}>
                <div className="space-y-3">
                  {!finance?.selectedOfferCurrent && <Notice tone="warn" role="status">{finance?.issue || 'Elige o reconfirma una oferta para esta hoja guardada.'}</Notice>}
                  {lenderOffers.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Sin decisiones aprobadas o condicionales de entidades</p>
                  ) : (
                    <Panel className="divide-y">
                      {lenderOffers.map(offer => (
                        <div key={offer.id} className="flex min-w-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <TitleLine as="p" tone={offerTone(offer)} status={offer.decision} className="text-sm font-medium">
                              {offer.providerKey}
                            </TitleLine>
                            <p className="pl-4 text-xs capitalize text-muted-foreground">{offer.decision}{offer.selected ? ' · selected' : ''}</p>
                          </div>
                          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:justify-end">
                            <dl className="grid grid-cols-3 gap-x-4 text-right text-[13px] tabular-nums">
                              <div><dt className="text-[12px] text-muted-foreground">Monto</dt><dd>{formatCurrency((offer.approvedAmountCents || 0) / 100)}</dd></div>
                              <div><dt className="text-[12px] text-muted-foreground">Tasa · plazo</dt><dd>{((offer.aprBasisPoints || 0) / 100).toFixed(2)}% · {offer.termMonths || '-'} mo</dd></div>
                              <div><dt className="text-[12px] text-muted-foreground">Pago</dt><dd>{formatCurrency((offer.monthlyPaymentCents || 0) / 100)}/mo</dd></div>
                            </dl>
                            <Track>
                              <Pill size="sm" variant={offer.selected ? 'primary' : 'raised'} disabled={updating || worksheetDirty || (offer.selected && Boolean(finance?.selectedOfferCurrent)) || deal.status !== 'pencil'} onClick={() => selectLenderOffer(offer.id)}>
                                {offer.selected && finance?.selectedOfferCurrent ? 'Current selection' : offer.selected ? 'Reconfirm offer' : 'Elegir oferta'}
                              </Pill>
                            </Track>
                          </div>
                        </div>
                      ))}
                    </Panel>
                  )}
                </div>
              </DeskSection>
            )}

            <DeskSection
              title="Lista de control"
              actions={
                <span className="flex items-center gap-2">
                  <Meter value={checklistComplete / dealChecklist.length} segments={dealChecklist.length} tone={checklistComplete === dealChecklist.length ? 'ok' : 'warn'} label="Avance del legajo" />
                  <span className="text-xs tabular-nums text-muted-foreground">{checklistComplete}/{dealChecklist.length} ready</span>
                </span>
              }
            >
              <div className="space-y-3">
                <Panel className="divide-y">
                  {dealChecklist.map(item => (
                    <div key={item.label} className="flex min-w-0 items-start justify-between gap-4 px-4 py-2.5">
                      <div className="min-w-0">
                        <TitleLine as="p" tone={item.complete ? 'ok' : 'warn'} status={item.complete ? 'Complete' : 'Open'} className="text-sm font-medium">
                          {item.label}
                        </TitleLine>
                        <p className="break-words pl-4 text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                      <span className="shrink-0 text-[12px] text-muted-foreground">{item.complete ? 'Done' : 'Open'}</span>
                    </div>
                  ))}
                </Panel>
                {deal.status !== 'delivered' && checklistComplete < dealChecklist.length && <Notice tone="warn" role="status">Legajo incompleto</Notice>}
              </div>
            </DeskSection>
          </div>

          <aside className="min-w-0 space-y-8 lg:sticky lg:top-6 lg:self-start">
            <DeskSection
              title="Cliente"
              actions={deal.lead ? <Link href={`${basePath}/platform/crm/${deal.lead.id}`} className="text-xs font-medium text-muted-foreground hover:text-foreground">Abrir ficha del cliente</Link> : undefined}
            >
              {deal.lead ? (
                <Facts items={[
                  { label: 'Nombre', value: `${deal.lead.firstName} ${deal.lead.lastName}` },
                  { label: 'Vendedor', value: deal.salesperson?.name || 'Unassigned' },
                ]} />
              ) : (
                <p className="py-2 text-sm text-muted-foreground">Sin cliente vinculado</p>
              )}
            </DeskSection>

            <DeskSection
              title="Vehículo"
              actions={<Link href={`${basePath}/platform/vehicles`} className="text-xs font-medium text-muted-foreground hover:text-foreground">Ver inventario</Link>}
            >
              {deal.vehicle ? (
                <Facts items={[
                  { label: 'Vehículo', value: `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` },
                  deal.vehicle.trim ? { label: 'Versión', value: deal.vehicle.trim } : null,
                  { label: 'Stock n.º', value: <Code className="text-foreground">{deal.vehicle.stockNumber}</Code> },
                  { label: 'VIN', value: <Code className="break-all text-foreground">{deal.vehicle.vin}</Code> },
                  { label: 'Color', value: deal.vehicle.exteriorColor || '-' },
                  { label: deal.vehicle.condition === 'new' ? 'MSRP' : 'Price', value: formatCurrency(deal.vehicle.price), mono: true },
                ]} />
              ) : (
                <p className="py-2 text-sm text-muted-foreground">Sin vehículo vinculado</p>
              )}
            </DeskSection>

            <DeskSection
              title="Usado y anticipo"
              actions={dealTradeIn ? <Link href={`${basePath}/platform/trade-ins/${dealTradeIn.id}`} className="text-xs font-medium text-muted-foreground hover:text-foreground">Abrir usado</Link> : undefined}
            >
              <div className="space-y-3">
                {dealTradeIn ? (
                  <TitleLine as="p" tone="ok" status="Trade-in attached" className="text-sm font-medium">
                    {tradeInName(dealTradeIn)}
                    <span className="font-normal text-muted-foreground"> · offer {formatCurrency((dealTradeIn.offerAmountCents || 0) / 100)}</span>
                  </TitleLine>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin usado vinculado</p>
                )}
                {savedPricing ? (
                  <Facts items={[
                    { label: 'Crédito por usado', value: formatCurrency(savedPricing.tradeInValueCents / 100), mono: true },
                    { label: downPaymentLabel, value: formatCurrency(savedPricing.downPaymentCents / 100), mono: true },
                    { label: 'Estructura', value: <span className="capitalize">{deal.structureType || 'cash'}</span> },
                  ]} />
                ) : (
                  <p className="py-2 text-sm text-muted-foreground">Sin hoja guardada</p>
                )}
                {deal.status === 'pencil' && (
                  <div className="space-y-1">
                    <Track>
                      {dealTradeIn ? (
                        <Pill size="sm" onClick={() => openTradeInDialog('detach')} disabled={updating || worksheetDirty} aria-describedby={worksheetDirty ? 'deal-trade-in-blocked' : undefined}>
                          <Unlink />
                          Desvincular usado
                        </Pill>
                      ) : (
                        <Pill size="sm" onClick={() => openTradeInDialog('attach')} disabled={updating || worksheetDirty} aria-describedby={worksheetDirty ? 'deal-trade-in-blocked' : undefined}>
                          <Link2 />
                          Vincular usado
                        </Pill>
                      )}
                    </Track>
                    {worksheetDirty && <p id="deal-trade-in-blocked" className="text-xs text-muted-foreground">Primero guarda la hoja</p>}
                  </div>
                )}
              </div>
            </DeskSection>

            <DeskSection
              title="F&I"
              actions={<Link href={`${basePath}/platform/finance`} className="text-xs font-medium text-muted-foreground hover:text-foreground">Abrir financiación</Link>}
            >
              <div className="space-y-3">
                <div className="min-w-0 rounded-md border bg-card text-[13px]">
                  <div className="flex items-baseline justify-between gap-3 border-b px-3 py-2">
                    <span className="font-medium text-foreground">Menu</span>
                    <span className="text-xs text-muted-foreground">{deal.products.length} {deal.products.length === 1 ? 'product' : 'products'}</span>
                  </div>
                  {deal.products.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Sin productos de financiación en la hoja</p>
                  ) : (
                    <ul className="divide-y">
                      {deal.products.map((line, index) => (
                        <li key={`menu-${index}`} className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-1.5">
                          <span className="min-w-0 truncate text-foreground">{line.name || line.code}</span>
                          <span className="shrink-0 tabular-nums text-foreground">{formatCurrency(lineCents(line) / 100)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {savedPricing && (
                    <div className="flex items-baseline justify-between gap-3 border-t bg-muted/40 px-3 py-2">
                      <span className="text-muted-foreground">Products total{worksheetDirty ? ' (saved)' : ''}</span>
                      <Figure size="sm">{formatCurrency(savedPricing.productsCents / 100)}</Figure>
                    </div>
                  )}
                </div>
                <Facts items={[
                  { label: 'Documentos de financiación', value: <Status tone={finance?.prerequisites?.current ? 'ok' : 'warn'}>{finance?.prerequisites?.current ? 'Current' : 'Requiere revisión'}</Status> },
                  { label: 'Fondeo', value: <Status tone={finance?.fundingCurrent ? 'ok' : 'warn'}>{finance?.fundingCurrent ? 'Current' : 'Requiere reconfirmación'}</Status> },
                  finance?.fundingStatus ? { label: 'Estado del fondeo', value: <span className="capitalize">{finance.fundingStatus}</span> } : null,
                  finance?.fundingReference ? { label: 'Referencia de fondeo', value: finance.fundingReference, mono: true } : null,
                  { label: 'Hoja de trabajo fondeada', value: finance?.fundingWorksheetVersion ? `v${finance.fundingWorksheetVersion}` : 'Ninguno' },
                ]} />
                {finance?.prerequisites?.issue && <p className="break-words text-xs text-muted-foreground">{finance.prerequisites.issue}</p>}
              </div>
            </DeskSection>
          </aside>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-8 border-t pt-8 lg:grid-cols-2">
          <div className="min-w-0 space-y-8">
            {deal.approvals && deal.approvals.length > 0 && (
              <DeskSection title="Historial de aprobaciones" count={deal.approvals.length}>
                <Panel className="divide-y">
                  {deal.approvals.map(approval => (
                    <div key={approval.id} className="min-w-0 px-4 py-3">
                      <TitleLine as="p" tone={approval.decision === 'approved' ? 'ok' : 'bad'} className="text-sm font-medium capitalize">
                        {approval.decision}
                      </TitleLine>
                      <p className="pl-4 text-xs text-muted-foreground">
                        {approval.approver?.name || 'Unknown'} · {formatDate(approval.approvalDate)}
                      </p>
                      {approval.notes && <p className="mt-1 break-words pl-4 text-sm">{approval.notes}</p>}
                    </div>
                  ))}
                </Panel>
              </DeskSection>
            )}

            <DeskSection title="Versiones de la hoja" count={worksheetHistory.length}>
              {worksheetHistory.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Sin historial de hojas</p>
              ) : (
                <Panel className="divide-y">
                  {worksheetHistory.map(entry => (
                    <details key={entry.id} className="min-w-0 text-sm">
                      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
                        <span className="font-medium">Version {entry.snapshot?.terms?.worksheetVersion}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{formatDate(entry.occurredAt)}</span>
                      </summary>
                      <pre className="mx-4 mb-3 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-[4px] bg-muted/50 p-2 font-mono text-xs text-muted-foreground">{JSON.stringify(entry.snapshot, null, 2)}</pre>
                    </details>
                  ))}
                </Panel>
              )}
            </DeskSection>
          </div>
          <DeskSection title="Historial de la operación">
            <FinanceEvidenceHistory dealId={deal.id} aggregateType="Deal" label="Historial de la operación" />
          </DeskSection>
        </div>

        <OperatorActionDialog
          open={acceptanceDialogOpen}
          title="Registrar aceptación del cliente"
          description="Registra cómo aceptó el cliente la hoja presentada."
          fields={[{ name: 'acknowledgment', label: 'Forma de aceptación o referencia', required: true, maxLength: 1000, placeholder: 'Por ejemplo: conformidad verbal en persona o referencia del documento firmado' }]}
          values={acceptanceValues}
          error={acceptanceError}
          busy={updating}
          submitLabel="Record acceptance"
          onValuesChange={values => setAcceptanceValues({ acknowledgment: values.acknowledgment || '' })}
          onSubmit={submitWorksheetAcceptance}
          onOpenChange={handleAcceptanceDialogOpenChange}
        />
        <OperatorActionDialog
          open={Boolean(approvalIntent)}
          title={approvalIntent?.title || 'Update deal'}
          fields={[{ name: 'notes', label: 'Notas de aprobación (opcional)', type: 'textarea', required: false, placeholder: 'Notas opcionales de la operación' }]}
          values={{ notes: approvalIntent?.notes || '' }}
          error={approvalError}
          busy={updating}
          submitLabel={approvalIntent?.submitLabel || 'Confirm transition'}
          onValuesChange={values => setApprovalIntent(current => current ? { ...current, notes: values.notes || '' } : current)}
          onSubmit={submitApprovalNotes}
          onOpenChange={handleApprovalNotesOpenChange}
        />
        <OperatorActionDialog
          open={reopenDialogOpen}
          title="Reabrir hoja"
          description="La operación vuelve a negociación y se borra la entidad elegida."
          fields={[{ name: 'reason', label: 'Motivo de reapertura', required: true, maxLength: 1000, placeholder: '¿Por qué hay que reabrir esta hoja?' }]}
          values={reopenValues}
          error={reopenError}
          busy={updating}
          submitLabel="Reopen worksheet"
          onValuesChange={values => setReopenValues({ reason: values.reason || '' })}
          onSubmit={submitReopenWorksheet}
          onOpenChange={handleReopenDialogOpenChange}
        />
        <OperatorActionDialog
          open={cancelDialogOpen}
          title="Cancelar operación"
          description={deal.status === 'pencil' ? 'La operación se cierra como cancelada.' : 'La operación se cierra como cancelada, el vehículo queda libre y se cancela cualquier entrega abierta.'}
          fields={[{ name: 'reason', label: 'Motivo de cancelación', type: 'textarea', required: true, maxLength: 1000 }]}
          values={cancelValues}
          error={cancelError}
          busy={updating}
          submitLabel="Cancel deal"
          onValuesChange={values => setCancelValues({ reason: values.reason || '' })}
          onSubmit={submitCancelDeal}
          onOpenChange={open => {
            setCancelDialogOpen(open)
            if (!open) setCancelError(null)
          }}
        />
        <OperatorActionDialog
          open={tradeInDialog !== null}
          title={tradeInDialog === 'attach' ? 'Vincular usado' : 'Desvincular usado'}
          description={tradeInDialog === 'attach' ? 'The appraisal offer becomes the trade credit; tax and payment are repriced.' : 'Trade credit returns to $0; tax and payment are repriced.'}
          fields={tradeInDialog === 'attach'
            ? [
                {
                  name: 'tradeInId',
                  label: 'Usado',
                  type: 'select',
                  placeholder: tradeInOptions === null ? 'Loading trade-ins' : tradeInOptions.length === 0 ? 'No available trade-ins' : 'Elige un usado',
                  options: (tradeInOptions || []).filter(option => option.offerAmountCents != null).map(option => ({ value: option.id, label: `${tradeInName(option)} · ${formatCurrency((option.offerAmountCents || 0) / 100)}` })),
                },
                { name: 'reason', label: 'Nota (opcional)', type: 'textarea', required: false, maxLength: 500 },
              ]
            : [{ name: 'reason', label: 'Motivo', type: 'textarea', required: true, maxLength: 500 }]}
          values={tradeInValues}
          error={tradeInError}
          busy={updating}
          submitLabel={tradeInDialog === 'attach' ? 'Attach' : 'Detach'}
          onValuesChange={values => setTradeInValues({ tradeInId: values.tradeInId || '', reason: values.reason || '' })}
          onSubmit={submitTradeIn}
          onOpenChange={open => {
            if (open) return
            setTradeInDialog(null)
            setTradeInError(null)
          }}
        />
      </div>
    </PageContainer>
  )
}
