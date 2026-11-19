'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, RefreshCw, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, DeskSection, DeskTable, Facts, Figure, Notice, Panel, Pill, Readout, ReadoutStrip, Segmented, Status, Td, Th, TitleLine, Tr, Track } from '@/features/platform/components/desk'
import { formatCentsForInput, parseDollarsToCents } from '@/features/platform/deals/lib/moneyInput'
import { cn } from '@/lib/utils'
import { getCancellationsWorkspace, recordProductCancellation } from '../actions/cancellations'
import { FinanceFormDialog, type FieldErrors, type FinanceFormField } from '../components/FinanceFormDialog'
import type { AcceptedMenu, CancellationDeal, CancellationRecord, CancellationsWorkspace } from '../lib/cancellationTypes'
import type { MenuOption } from '../lib/menuTypes'
import { daysSince, formatAge, formatCents, formatDateTime, formatDay, newIdempotencyKey, personName, stateTone, vehicleName } from '../lib/display'
import { calculateRefund, monthsBetween, type RefundBasis } from '../lib/refund'

type Tab = 'requested' | 'completed' | 'denied' | 'all'
type CancellationCase = {
  key: string
  deal: CancellationDeal | null
  menu: NonNullable<CancellationRecord['menu']>
  productCode: string
  option: MenuOption | null
  records: CancellationRecord[]
  latest: CancellationRecord
}
type DialogState =
  | { kind: 'new'; values: Record<string, string>; idempotencyKey: string }
  | { kind: 'complete' | 'deny'; item: CancellationCase; values: Record<string, string>; idempotencyKey: string }

const statusLabels: Record<string, string> = { requested: 'Solicitado', completed: 'Completada', denied: 'Denegada' }

function buildCases(records: CancellationRecord[]): CancellationCase[] {
  const groups = new Map<string, CancellationRecord[]>()
  for (const record of records) {
    if (!record.menu) continue
    const key = `${record.menu.id}:${record.productCode}`
    groups.set(key, [...(groups.get(key) || []), record])
  }
  return [...groups.entries()].map(([key, items]) => {
    const sorted = [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    const latest = sorted[sorted.length - 1]
    const option = (latest.menu?.optionsSnapshot || []).find(item => item.code === latest.productCode) || null
    return { key, deal: latest.deal, menu: latest.menu!, productCode: latest.productCode, option, records: sorted.reverse(), latest }
  }).sort((a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime())
}

function saleDateOf(item: { deal: CancellationDeal | null; menu: { decidedAt: string | null } }) {
  return item.deal?.saleDate || item.menu.decidedAt
}

export function FinanceCancellationsPageClient({
  initial,
  initialError,
  timeZone,
  focusDealId,
}: {
  initial: CancellationsWorkspace | null
  initialError: string | null
  timeZone: string
  focusDealId: string | null
}) {
  const router = useRouter()
  const [workspace, setWorkspace] = useState<CancellationsWorkspace | null>(initial)
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('requested')
  const [search, setSearch] = useState('')
  const [dealFilter, setDealFilter] = useState<string | null>(focusDealId)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [calc, setCalc] = useState<{ key: string; monthsUsed: string; fee: string } | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = async () => {
    setLoading(true)
    const response = await getCancellationsWorkspace()
    if (response.success) { setWorkspace(response.data); setError(null) } else setError(response.error)
    setLoading(false)
    router.refresh()
  }

  const cases = useMemo(() => buildCases(workspace?.cancellations || []), [workspace])
  const scoped = dealFilter ? cases.filter(item => item.deal?.id === dealFilter) : cases
  const counts: Record<Tab, number> = {
    requested: scoped.filter(item => item.latest.status === 'requested').length,
    completed: scoped.filter(item => item.latest.status === 'completed').length,
    denied: scoped.filter(item => item.latest.status === 'denied').length,
    all: scoped.length,
  }
  const term = search.trim().toLowerCase()
  const visible = scoped
    .filter(item => tab === 'all' || item.latest.status === tab)
    .filter(item => !term || `${personName(item.deal?.lead)} ${vehicleName(item.deal?.vehicle)} ${item.deal?.vehicle?.stockNumber || ''} ${item.productCode} ${item.option?.name || ''}`.toLowerCase().includes(term))
  const selected = visible.find(item => item.key === selectedKey) ?? null
  const refundedTotal = cases.filter(item => item.latest.status === 'completed').reduce((sum, item) => sum + (item.latest.refundCents || 0), 0)

  // Accepted-menu products that can still be cancelled: no open or completed case.
  const cancellable = useMemo(() => {
    const blocked = new Set(cases.filter(item => item.latest.status !== 'denied').map(item => item.key))
    return (workspace?.acceptedMenus || []).flatMap((menu: AcceptedMenu) => (menu.selectedProductCodes || [])
      .filter(code => !blocked.has(`${menu.id}:${code}`))
      .map(code => ({ menu, code, option: (menu.optionsSnapshot || []).find(item => item.code === code) || null })))
  }, [cases, workspace])
  const cancellableForFilter = dealFilter ? cancellable.filter(item => item.menu.deal?.id === dealFilter) : cancellable

  const basisFor = (item: CancellationCase): RefundBasis => {
    const state = calc?.key === item.key ? calc : null
    const prior = item.latest.evidence?.refundBasis
    const monthsUsed = state ? Number(state.monthsUsed) : prior?.monthsUsed ?? monthsBetween(saleDateOf(item) || new Date().toISOString(), new Date())
    const fee = state ? parseDollarsToCents(state.fee) : prior?.cancellationFeeCents ?? 0
    const termMonths = item.option?.termMonths || 0
    return {
      method: termMonths > 0 ? 'pro-rata-months' : 'flat',
      retailPriceCents: item.option?.retailPriceCents || 0,
      termMonths,
      monthsUsed: Number.isInteger(monthsUsed) && monthsUsed >= 0 ? Math.min(monthsUsed, 240) : 0,
      cancellationFeeCents: fee ?? 0,
    }
  }

  const openNew = () => {
    setFieldErrors({}); setFormError(null)
    const first = cancellableForFilter.length === 1 ? `${cancellableForFilter[0].menu.id}|${cancellableForFilter[0].code}` : ''
    setDialog({ kind: 'new', idempotencyKey: newIdempotencyKey('finance-cancellation'), values: { product: first, reason: '', estimate: '' } })
  }
  const openDecision = (kind: 'complete' | 'deny', item: CancellationCase) => {
    setFieldErrors({}); setFormError(null)
    const refund = calculateRefund(basisFor(item)).refundCents
    setDialog({
      kind, item, idempotencyKey: newIdempotencyKey('finance-cancellation'),
      values: kind === 'complete' ? { reason: item.latest.reason, refund: formatCentsForInput(refund), reference: '' } : { reason: '' },
    })
  }

  const submit = async () => {
    if (!dialog) return
    const v = dialog.values
    const errors: FieldErrors = {}
    if (!(v.reason || '').trim()) errors.reason = dialog.kind === 'deny' ? 'Indica por qué se denegó la cancelación.' : 'Indica el motivo de la cancelación.'
    let payload: Parameters<typeof recordProductCancellation>[0] | null = null
    if (dialog.kind === 'new') {
      const [menuId, code] = (v.product || '').split('|')
      const target = cancellable.find(item => item.menu.id === menuId && item.code === code)
      if (!target?.menu.deal) errors.product = 'Select a sold product.'
      const estimate = (v.estimate || '').trim() ? parseDollarsToCents(v.estimate) : 0
      if (estimate == null) errors.estimate = 'Ingresa un importe.'
      if (target?.menu.deal && estimate != null) payload = {
        dealId: target.menu.deal.id, menuId: target.menu.id, productCode: target.code, status: 'requested',
        reason: v.reason.trim(), refundCents: estimate, refundBasis: null, idempotencyKey: dialog.idempotencyKey,
      }
    } else if (dialog.kind === 'complete') {
      const refund = (v.refund || '').trim() ? parseDollarsToCents(v.refund) : null
      if (refund == null) errors.refund = 'Enter the refund amount, $0 if none.'
      if (!(v.reference || '').trim()) errors.reference = 'Enter the provider cancellation reference.'
      const basis = basisFor(dialog.item)
      if (refund != null && dialog.item.deal) payload = {
        dealId: dialog.item.deal.id, menuId: dialog.item.menu.id, productCode: dialog.item.productCode, status: 'completed',
        reason: v.reason.trim(), refundCents: refund, refundBasis: basis, evidenceReference: v.reference.trim(), idempotencyKey: dialog.idempotencyKey,
      }
    } else if (dialog.item.deal) {
      payload = {
        dealId: dialog.item.deal.id, menuId: dialog.item.menu.id, productCode: dialog.item.productCode, status: 'denied',
        reason: v.reason.trim(), refundCents: 0, refundBasis: null, idempotencyKey: dialog.idempotencyKey,
      }
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length || !payload) return
    setBusy(true); setFormError(null)
    const response = await recordProductCancellation(payload)
    setBusy(false)
    if (!response.success) { setFormError(response.error); return }
    setDialog(null)
    setNotice(`${payload.productCode} cancellation ${payload.status}.`)
    if (dialog.kind === 'new') { setTab('requested'); setSelectedKey(`${payload.menuId}:${payload.productCode}`) }
    if (dialog.kind === 'complete') setTab('completed')
    if (dialog.kind === 'deny') setTab('denied')
    await reload()
  }

  const dialogFields: FinanceFormField[] = !dialog ? [] : dialog.kind === 'new' ? [
    {
      name: 'product', label: 'Producto vendido', type: 'select', wide: true,
      options: cancellableForFilter.map(item => ({
        value: `${item.menu.id}|${item.code}`,
        label: `${personName(item.menu.deal?.lead)} · ${item.option?.name || item.code} (${item.code}) · ${formatCents(item.option?.retailPriceCents ?? null)}`,
      })),
      placeholder: cancellableForFilter.length ? 'Elige un producto' : 'No hay productos vendidos para cancelar',
    },
    { name: 'reason', label: 'Motivo', type: 'textarea', maxLength: 1000 },
    { name: 'estimate', label: 'Devolución estimada (opcional)', type: 'money' },
  ] : dialog.kind === 'complete' ? [
    { name: 'refund', label: 'Importe a devolver', type: 'money', description: `Calculated ${formatCents(calculateRefund(basisFor(dialog.item)).refundCents)}` },
    { name: 'reference', label: 'Referencia de cancelación', maxLength: 200 },
    { name: 'reason', label: 'Motivo', type: 'textarea', maxLength: 1000 },
  ] : [
    { name: 'reason', label: 'Motivo del rechazo', type: 'textarea', maxLength: 1000 },
  ]

  const breadcrumbs = [
    { type: 'link' as const, label: 'Inicio', href: basePath },
    { type: 'page' as const, label: 'Gestión' },
    { type: 'link' as const, label: 'Solicitudes de crédito', href: `${basePath}/platform/finance` },
    { type: 'page' as const, label: 'Cancelaciones' },
  ]
  const header = (
    <DeskHeader
      title="Cancelaciones de productos"
      tone={error ? 'bad' : counts.requested > 0 ? 'warn' : 'ok'}
      status={error ? 'No disponible' : `${counts.requested} requested`}
      meta={error ? 'No disponible' : `${counts.requested} solicitadas · ${counts.completed} completadas · ${counts.denied} denegadas`}
      actions={
        <>
          <Pill asChild variant="plain"><Link href={`${basePath}/platform/finance`}><ArrowLeft />Financiación</Link></Pill>
          <Pill variant="plain" onClick={reload} disabled={loading} aria-label="Actualizar"><RefreshCw className={loading ? 'animate-spin' : undefined} />Actualizar</Pill>
          <Pill variant="primary" onClick={openNew} disabled={!cancellableForFilter.length} title={!cancellableForFilter.length ? 'No accepted menu products to cancel' : undefined}>
            <Plus />Nueva cancelación
          </Pill>
        </>
      }
    />
  )

  if (error && !workspace) {
    return (
      <PageContainer title="Cancelaciones de productos" header={header} breadcrumbs={breadcrumbs}>
        <div className="space-y-3 px-4 pb-24 md:px-6">
          <Notice tone="bad"><p className="font-medium">Las cancelaciones no están disponibles</p><p className="mt-0.5 text-muted-foreground">{error}</p></Notice>
          <Track><Pill onClick={reload} disabled={loading}>Reintentar</Pill></Track>
        </div>
      </PageContainer>
    )
  }

  const renderDetail = (item: CancellationCase) => {
    const basis = basisFor(item)
    const result = calculateRefund(basis)
    const calcState = calc?.key === item.key ? calc : { key: item.key, monthsUsed: String(basis.monthsUsed), fee: formatCentsForInput(basis.cancellationFeeCents) }
    const feeInvalid = parseDollarsToCents(calcState.fee) == null
    const monthsInvalid = !/^\d{1,3}$/.test(calcState.monthsUsed.trim())
    const open = item.latest.status === 'requested'
    const dealRefunds = workspace?.refunds?.filter(refund => refund.transaction?.deal?.id === item.deal?.id) ?? null
    const dealPayments = workspace?.payments?.filter(payment => payment.deal?.id === item.deal?.id) ?? null
    const reference = item.latest.evidence?.evidenceReference
    return (
      <div className="min-w-0 space-y-6">
        <div className="space-y-3">
          <TitleLine as="h2" tone={stateTone(item.latest.status)} status={statusLabels[item.latest.status] || item.latest.status} className="text-lg font-semibold tracking-tight">
            {item.option?.name || item.productCode} · {personName(item.deal?.lead)}
          </TitleLine>
          <p className="flex flex-wrap gap-x-2 pl-4 text-xs text-muted-foreground">
            <Code>{item.productCode}</Code><span>·</span><span>{statusLabels[item.latest.status] || item.latest.status}</span><span>·</span>
            <span>{vehicleName(item.deal?.vehicle)}</span>
            {item.deal?.vehicle?.stockNumber && (<><span>·</span><Code>#{item.deal.vehicle.stockNumber}</Code></>)}
          </p>
          <Track aria-label="Acciones de cancelación">
            <Pill size="sm" variant="primary" disabled={!open || busy || !item.deal} title={!open ? `Already ${item.latest.status}` : undefined} onClick={() => openDecision('complete', item)}>Completar</Pill>
            <Pill size="sm" variant="danger" disabled={!open || busy || !item.deal} title={!open ? `Already ${item.latest.status}` : undefined} onClick={() => openDecision('deny', item)}>Denegar</Pill>
            {item.deal && <Pill size="sm" asChild><Link href={`${basePath}/platform/deals/${item.deal.id}`}>Operación</Link></Pill>}
          </Track>
          {!open && <p className="pl-4 text-xs text-muted-foreground">{statusLabels[item.latest.status]} {formatDay(item.latest.completedAt || item.latest.createdAt, timeZone)}{reference ? ` · ${reference}` : ''}</p>}
        </div>

        <DeskSection title="Producto">
          <Facts items={[
            { label: 'Precio de venta', value: formatCents(item.option?.retailPriceCents ?? null) },
            { label: 'Plazo', value: item.option?.termMonths ? `${item.option.termMonths} mo` : 'Sin registrar' },
            { label: 'Vendido', value: formatDay(saleDateOf(item), timeZone) },
            { label: 'Menú', value: `v${item.menu.version}` },
            item.deal?.rooftop ? { label: 'Sucursal', value: item.deal.rooftop.name } : null,
            { label: 'Devolución registrada', value: formatCents(item.latest.refundCents ?? 0) },
          ]} />
        </DeskSection>

        <DeskSection title="Cálculo de la devolución">
          <div className="space-y-3">
            {open ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  <span className="text-[12px] font-medium text-muted-foreground">Meses usados</span>
                  <Input className="h-10 rounded-[4px]" inputMode="numeric" value={calcState.monthsUsed} aria-invalid={monthsInvalid} onChange={event => setCalc({ ...calcState, monthsUsed: event.target.value })} />
                  {monthsInvalid && <span className="text-xs text-red-600 dark:text-red-400">Ingresa meses enteros.</span>}
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-[12px] font-medium text-muted-foreground">Cargo por cancelación</span>
                  <Input className="h-10 rounded-[4px]" inputMode="decimal" value={calcState.fee} aria-invalid={feeInvalid} onChange={event => setCalc({ ...calcState, fee: event.target.value })} />
                  {feeInvalid && <span className="text-xs text-red-600 dark:text-red-400">Ingresa un importe.</span>}
                </label>
              </div>
            ) : null}
            <Facts items={[
              { label: 'Método', value: basis.method === 'pro-rata-months' ? 'Proporcional por mes' : 'Fijo (sin plazo)' },
              basis.method === 'pro-rata-months' ? { label: 'Meses sin usar', value: `${result.unusedMonths} of ${basis.termMonths}` } : null,
              { label: 'Valor no usado', value: formatCents(result.unusedCents) },
              { label: 'Cargo', value: formatCents(basis.cancellationFeeCents) },
              { label: open ? 'Devolución pendiente' : 'Devolución calculada', value: <span className="font-semibold">{formatCents(result.refundCents)}</span> },
            ]} />
          </div>
        </DeskSection>

        <DeskSection title="Devolución del pago" count={dealRefunds?.length}>
          {dealRefunds == null ? (
            <p className="py-3 text-sm text-muted-foreground">Pagos no disponibles para tu rol</p>
          ) : dealRefunds.length > 0 ? (
            <ul className="divide-y text-sm">
              {dealRefunds.map(refund => (
                <li key={refund.id} className="flex min-w-0 items-center justify-between gap-4 py-2">
                  <div className="min-w-0">
                    <TitleLine as="p" tone={stateTone(refund.status)} status={refund.status}>{formatCents(refund.amountCents)} · {refund.status}</TitleLine>
                    <p className="truncate pl-4 text-xs text-muted-foreground">{refund.reason} · {formatDay(refund.createdAt, timeZone)}</p>
                  </div>
                  {refund.transaction && (
                    <Track className="shrink-0"><Pill size="sm" asChild><Link href={`${basePath}/platform/payments/${refund.transaction.id}`}>Abierta</Link></Pill></Track>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2 py-1">
              <p className="text-sm text-muted-foreground">Sin devolución en esta operación</p>
              {(dealPayments || []).filter(payment => ['captured', 'partially-refunded'].includes(payment.status)).map(payment => (
                <div key={payment.id} className="flex min-w-0 items-center justify-between gap-4 text-sm">
                  <span className="min-w-0 truncate">Payment {formatCents(payment.capturedCents ?? payment.amountCents)} · {payment.status}</span>
                  <Track className="shrink-0"><Pill size="sm" asChild><Link href={`${basePath}/platform/payments/${payment.id}`}>Pago</Link></Pill></Track>
                </div>
              ))}
            </div>
          )}
        </DeskSection>

        <DeskSection title="Historial" count={item.records.length}>
          <ul className="divide-y text-sm">
            {item.records.map(record => (
              <li key={record.id} className="flex min-w-0 items-start justify-between gap-4 py-2">
                <div className="min-w-0">
                  <TitleLine as="p" tone={stateTone(record.status)} status={record.status} className="font-medium">{statusLabels[record.status] || record.status}</TitleLine>
                  <p className="break-words pl-4 text-xs text-muted-foreground">{record.reason}{record.evidence?.evidenceReference ? ` · ${record.evidence.evidenceReference}` : ''}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium tabular-nums">{formatCents(record.refundCents ?? 0)}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">{formatDateTime(record.createdAt, timeZone)}</p>
                </div>
              </li>
            ))}
          </ul>
        </DeskSection>
      </div>
    )
  }

  const filteredDeal = dealFilter ? cases.find(item => item.deal?.id === dealFilter)?.deal || cancellable.find(item => item.menu.deal?.id === dealFilter)?.menu.deal : null

  return (
    <PageContainer title="Cancelaciones de productos" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-6 px-4 pb-24 md:px-6">
        {notice && (
          <Notice tone="ok">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0">{notice}</p>
              <Track><Pill size="sm" variant="plain" onClick={() => setNotice(null)}>Descartar</Pill></Track>
            </div>
          </Notice>
        )}
        {error && <Notice tone="bad">{error}</Notice>}

        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <Segmented
            label="Estado de la cancelación"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'requested', label: 'Solicitado', count: counts.requested, tone: 'warn' },
              { value: 'completed', label: 'Completada', count: counts.completed, tone: 'ok' },
              { value: 'denied', label: 'Denegada', count: counts.denied, tone: 'bad' },
              { value: 'all', label: 'Todas', count: counts.all },
            ]}
          />
          <div className="relative min-w-0 flex-1 lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-10 rounded-[4px] pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar cliente, stock o producto" aria-label="Buscar cancelaciones" />
          </div>
          {dealFilter && (
            <Track>
              <Pill size="sm" onClick={() => setDealFilter(null)} aria-label="Quitar filtro de operación">
                {filteredDeal ? `${personName(filteredDeal.lead)} · ${vehicleName(filteredDeal.vehicle)}` : 'Una operación'}
                <X />
              </Pill>
            </Track>
          )}
          {loading && <span className="text-sm text-muted-foreground" role="status">Actualizando…</span>}
        </div>

        {selected && (
          <Panel className="p-4 md:p-5" aria-label="Cancelación seleccionada">
            <div className="mb-3 flex justify-end">
              <Pill size="sm" variant="plain" className="max-md:h-10" onClick={() => setSelectedKey(null)}><X />Cerrar</Pill>
            </div>
            {renderDetail(selected)}
          </Panel>
        )}

        <DeskSection title="Cancelaciones" count={visible.length}>
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
              <p>{scoped.length === 0 ? 'Sin cancelaciones' : 'No hay cancelaciones que coincidan'}</p>
              <Track>
                {scoped.length > 0 && <Pill size="sm" onClick={() => { setSearch(''); setTab('all') }}>Limpiar filtros</Pill>}
                {cancellableForFilter.length > 0 && <Pill size="sm" variant="primary" onClick={openNew}>Nueva cancelación</Pill>}
              </Track>
            </div>
          ) : (
            <DeskTable>
              <thead>
                <tr>
                  <Th>Cliente · producto</Th>
                  <Th>Estado</Th>
                  <Th priority={3}>Vehículo</Th>
                  <Th priority={2}>Solicitado</Th>
                  <Th priority={2} align="right">Antigüedad</Th>
                  <Th align="right">Devolución</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map(item => {
                  const isSelected = selected?.key === item.key
                  const open = item.latest.status === 'requested'
                  const requestedAt = item.records[item.records.length - 1]?.requestedAt || item.latest.requestedAt
                  return (
                    <Tr key={item.key} className={cn('cursor-pointer', isSelected && 'bg-muted/60')} onClick={() => setSelectedKey(item.key)}>
                      <Td>
                        <button
                          type="button"
                          onClick={event => { event.stopPropagation(); setSelectedKey(item.key) }}
                          aria-pressed={isSelected}
                          className="flex min-h-10 min-w-0 flex-col items-start justify-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="font-medium text-foreground hover:underline">{personName(item.deal?.lead)} · {item.option?.name || item.productCode}</span>
                          <Code>{item.productCode}</Code>
                        </button>
                      </Td>
                      <Td><Status tone={stateTone(item.latest.status)}>{statusLabels[item.latest.status] || item.latest.status}</Status></Td>
                      <Td priority={3} className="text-muted-foreground">
                        {vehicleName(item.deal?.vehicle)}
                        {item.deal?.vehicle?.stockNumber && <> <Code>#{item.deal.vehicle.stockNumber}</Code></>}
                      </Td>
                      <Td priority={2} className="whitespace-nowrap text-muted-foreground">{formatDay(requestedAt, timeZone)}</Td>
                      <Td priority={2} align="right">{open ? <Figure size="sm">{formatAge(daysSince(requestedAt))}</Figure> : <span className="text-muted-foreground">-</span>}</Td>
                      <Td align="right"><Figure size="sm">{formatCents(item.latest.refundCents ?? 0)}</Figure></Td>
                    </Tr>
                  )
                })}
              </tbody>
            </DeskTable>
          )}
        </DeskSection>

        <ReadoutStrip>
          <Readout label="Solicitado" value={counts.requested} tone={counts.requested ? 'warn' : 'idle'} />
          <Readout label="Completada" value={counts.completed} tone="ok" />
          <Readout label="Devuelto" value={formatCents(refundedTotal)} sub="Completed cancellations" />
          <Readout label="Cancelable" value={cancellableForFilter.length} sub="Sold products" />
        </ReadoutStrip>

        <FinanceFormDialog
          open={Boolean(dialog)}
          title={dialog?.kind === 'new' ? 'Nueva cancelación' : dialog?.kind === 'complete' ? `Complete ${dialog.item.productCode} cancellation` : `Deny ${dialog?.kind === 'deny' ? dialog.item.productCode : ''} cancellation`}
          fields={dialogFields}
          values={dialog?.values || {}}
          errors={fieldErrors}
          error={formError}
          busy={busy}
          submitLabel={dialog?.kind === 'new' ? 'Record request' : dialog?.kind === 'complete' ? 'Completar' : 'Denegar'}
          onValuesChange={values => setDialog(current => current ? { ...current, values } as DialogState : current)}
          onSubmit={submit}
          onOpenChange={open => { if (!open && !busy) setDialog(null) }}
        />
      </div>
    </PageContainer>
  )
}
