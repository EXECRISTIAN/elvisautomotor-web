'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, ListChecks, Mail, Phone, Plus, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import {
  Attention,
  DeskHeader,
  DeskSection,
  DeskTable,
  Figure,
  Notice,
  Panel,
  Pill,
  Readout,
  ReadoutStrip,
  Segmented,
  Status,
  Td,
  Th,
  Tr,
  Track,
} from '@/features/platform/components/desk'
import { dayKey, formatPhone } from '@/features/platform/lib/format'
import {
  createLead,
  getLeadList,
  getLeadVehicleOptions,
  getRooftopStaff,
  type CrmLeadRow,
  type CrmPerson,
  type CrmRooftop,
  type CrmVehicleOption,
  type CrmViewer,
  type LeadListCounts,
  type LeadListFilters,
} from '../actions'
import { CLOSED_LEAD_STATUSES, LEAD_SOURCES, LEAD_STATUSES, formatElapsed, leadStatus, personName, sourceLabel, timeframeLabel } from '../lib/leadOptions'
import { EMPTY_LEAD_FORM, LeadFormDialog, type LeadFormValues } from '../components/LeadFormDialog'

type ListData = { leads: CrmLeadRow[]; counts: LeadListCounts; pageSize: number; page: number }

const isClosed = (status: string | null) => CLOSED_LEAD_STATUSES.includes(status || '')
const QUEUE_LIMIT = 8
const FILTER_TRIGGER = 'h-10 min-w-0 rounded-[4px] px-2.5 text-[13px] lg:h-9'
const vehicleLabel = (lead: CrmLeadRow) =>
  lead.interestedVehicle ? [lead.interestedVehicle.year, lead.interestedVehicle.make, lead.interestedVehicle.model].filter(Boolean).join(' ') : null
const isOverdue = (lead: CrmLeadRow) =>
  !isClosed(lead.status) && !lead.firstResponseAt && Boolean(lead.firstResponseDueAt) && new Date(lead.firstResponseDueAt as string).getTime() < Date.now()

export function LeadListPageClient({
  viewer,
  rooftops,
  staff,
  initialFilters,
  initialData,
  initialQueue = [],
  initialError,
  timeZone,
}: {
  viewer: CrmViewer | null
  rooftops: CrmRooftop[]
  staff: CrmPerson[]
  initialFilters: LeadListFilters
  initialData: ListData | null
  initialQueue?: CrmLeadRow[]
  initialError: string | null
  timeZone: string
}) {
  const router = useRouter()
  const [filters, setFilters] = useState<LeadListFilters>(initialFilters)
  const [searchInput, setSearchInput] = useState(initialFilters.search)
  const [data, setData] = useState<ListData | null>(initialData)
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)
  const [queue, setQueue] = useState<CrmLeadRow[]>(initialQueue)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [vehicles, setVehicles] = useState<CrmVehicleOption[]>([])
  const createKeyRef = useRef<string | null>(null)
  const firstLoad = useRef(true)
  const requestId = useRef(0)

  const load = useCallback(async (next: LeadListFilters) => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    const response = await getLeadList(next)
    if (id !== requestId.current) return
    if (response.success) setData(response.data)
    else setError(response.error || 'No se pudieron cargar las consultas')
    setLoading(false)
  }, [])

  const loadQueue = useCallback(async () => {
    const response = await getLeadList({ ...initialFilters, sort: 'sla', page: 0 })
    if (response.success) { setQueue(response.data.leads); setQueueError(null) }
    else setQueueError(response.error || 'No se pudieron cargar las consultas')
  }, [initialFilters])

  useEffect(() => {
    if (firstLoad.current) { firstLoad.current = false; return }
    load(filters)
  }, [filters, load])

  useEffect(() => {
    const handle = setTimeout(() => {
      setFilters(prev => (prev.search === searchInput.trim() ? prev : { ...prev, search: searchInput.trim(), page: 0 }))
    }, 300)
    return () => clearTimeout(handle)
  }, [searchInput])

  const update = (patch: Partial<LeadListFilters>) => setFilters(prev => ({ ...prev, ...patch, page: patch.page ?? 0 }))

  const counts = data?.counts
  const statusOptions = [
    { value: 'open', label: 'Abierta', count: counts?.open },
    ...LEAD_STATUSES.map(stage => ({ value: stage.value, label: stage.label, count: counts?.[stage.value as keyof LeadListCounts], tone: stage.tone })),
    { value: 'overdue', label: 'Vencida', count: counts?.overdue, tone: 'bad' as const },
    { value: 'all', label: 'Todas', count: counts?.all },
  ]
  const total = counts ? (filters.status in counts ? counts[filters.status as keyof LeadListCounts] : counts.all) : 0
  const pageSize = data?.pageSize ?? 50
  const pageStart = total === 0 ? 0 : filters.page * pageSize + 1
  const pageEnd = Math.min(total, (filters.page + 1) * pageSize)
  const isFiltered = Boolean(filters.search) || filters.source !== 'all' || filters.ownerId !== initialFilters.ownerId

  const resetFilters = () => {
    setSearchInput('')
    setFilters({ ...initialFilters, status: filters.status })
  }

  const openCreate = async () => {
    createKeyRef.current = `lead-create:${crypto.randomUUID()}`
    setCreateOpen(true)
    if (vehicles.length === 0) setVehicles(await getLeadVehicleOptions())
  }

  const submitCreate = async (values: LeadFormValues) => {
    const rooftopId = values.rooftopId || (rooftops.length === 1 ? rooftops[0].id : '')
    if (!rooftopId) return 'Elige una sucursal'
    const response = await createLead({ ...values, rooftopId, idempotencyKey: createKeyRef.current || `lead-create:${crypto.randomUUID()}` })
    if (!response.success) return response.error
    createKeyRef.current = null
    setCreateOpen(false)
    router.push(`${basePath}/platform/crm/${response.data.openLead.id}`)
    return null
  }

  const formatAge = (date: string) => {
    const days = Math.round((Date.parse(dayKey(Date.now(), timeZone)) - Date.parse(dayKey(date, timeZone))) / 86_400_000)
    if (days === 0) return 'today'
    if (days === 1) return 'yesterday'
    if (days > 1 && days < 7) return `hace ${days} días`
    return new Date(date).toLocaleDateString('es-AR', { timeZone, month: 'short', day: 'numeric' })
  }
  const formatDue = (date: string) => new Date(date).toLocaleString('es-AR', { timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  const nextStep = (lead: CrmLeadRow): { label: string; bad?: boolean } => {
    if (isClosed(lead.status)) return { label: leadStatus(lead.status).label }
    if (isOverdue(lead)) return { label: 'Respuesta vencida', bad: true }
    if (!lead.firstResponseAt && lead.firstResponseDueAt) return { label: `Respond by ${formatDue(lead.firstResponseDueAt)}` }
    if (!lead.firstResponseAt) return { label: 'Primera respuesta' }
    return { label: 'Seguimiento' }
  }

  const canCreate = viewer?.canManageLeads === true
  const rooftopForCreate = rooftops.length === 1 ? rooftops[0].id : ''

  // Waiting on a first response, most overdue first, then the longest waiting.
  const now = Date.now()
  const waiting = queue
    .filter(lead => !isClosed(lead.status) && !lead.firstResponseAt)
    .sort((a, b) =>
      (a.firstResponseDueAt ? Date.parse(a.firstResponseDueAt) : Infinity) - (b.firstResponseDueAt ? Date.parse(b.firstResponseDueAt) : Infinity)
      || Date.parse(a.createdAt) - Date.parse(b.createdAt))
  const waitingShown = waiting.slice(0, QUEUE_LIMIT)

  const breadcrumbs = [
    { type: 'link' as const, label: 'Inicio', href: basePath },
    { type: 'page' as const, label: 'Gestión' },
    { type: 'page' as const, label: 'Consultas' },
  ]

  const refreshAll = () => {
    load(filters)
    loadQueue()
  }

  const header = (
    <DeskHeader
      title="Consultas"
      tone={error ? 'bad' : (counts?.overdue ?? 0) > 0 ? 'warn' : 'ok'}
      status={error ? 'No disponible' : (counts?.overdue ?? 0) > 0 ? `${counts?.overdue} respuestas vencidas` : 'No hay respuestas vencidas'}
      meta={counts ? `${counts.open} abiertas · ${counts.overdue} con respuesta vencida` : undefined}
      actions={
        <>
          <Pill variant="plain" onClick={refreshAll} disabled={loading} aria-label="Actualizar" className="max-md:h-10">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
          </Pill>
          <Pill asChild variant="plain" className="max-md:h-10">
            <Link href={`${basePath}/platform/crm/tasks`}><ListChecks />Mis tareas</Link>
          </Pill>
          {canCreate && (
            <Pill variant="primary" onClick={openCreate} className="max-md:h-10">
              <Plus />Nueva consulta
            </Pill>
          )}
        </>
      }
    />
  )

  const openLead = (id: string) => router.push(`${basePath}/platform/crm/${id}`)

  return (
    <PageContainer title="Consultas" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-8 px-4 pb-24 md:px-6">

        <DeskSection
          id="crm-waiting"
          title="Esperando primera respuesta"
          count={waiting.length}
          actions={waiting.length > QUEUE_LIMIT ? (
            <Pill size="sm" variant="plain" className="max-md:h-10" onClick={() => update({ status: 'overdue', sort: 'sla' })}>
              Show overdue
            </Pill>
          ) : undefined}
        >
          {queueError ? (
            <Notice tone="bad">Unable to load the response queue: {queueError}</Notice>
          ) : waitingShown.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No hay consultas esperando primera respuesta</p>
          ) : (
            <DeskTable aria-label="Consultas esperando primera respuesta">
              <thead>
                <tr>
                  <Th align="right" className="w-20">Esperando</Th>
                  <Th>Consulta</Th>
                  <Th priority={2}>Interés</Th>
                  <Th priority={3}>Responsable</Th>
                  <Th priority={2}>Responder antes de</Th>
                  <Th className="w-0"><span className="sr-only">Contacto</span></Th>
                </tr>
              </thead>
              <tbody>
                {waitingShown.map(lead => {
                  const overdue = isOverdue(lead)
                  const vehicle = vehicleLabel(lead)
                  return (
                    <Tr key={lead.id} className="cursor-pointer" onClick={() => openLead(lead.id)}>
                      <Td align="right">
                        <Figure size="sm" attention={overdue}>{formatElapsed(Date.parse(lead.createdAt), now)}</Figure>
                        {overdue && <span className="sr-only"> overdue</span>}
                      </Td>
                      <Td className="min-w-0">
                        <Link href={`${basePath}/platform/crm/${lead.id}`} onClick={event => event.stopPropagation()} className="font-medium text-foreground hover:underline">
                          {personName(lead.firstName, lead.lastName, 'Consulta sin nombre')}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground md:hidden">
                          {overdue ? 'Respuesta vencida' : lead.firstResponseDueAt ? `Vence ${formatDue(lead.firstResponseDueAt)}` : 'Sin respuesta todavía'}
                        </p>
                      </Td>
                      <Td priority={2} className="text-muted-foreground">{[sourceLabel(lead.source), vehicle].filter(Boolean).join(' · ')}</Td>
                      <Td priority={3} className={lead.assignedSalesperson ? 'text-foreground' : 'text-muted-foreground'}>{lead.assignedSalesperson?.name || 'Sin asignar'}</Td>
                      <Td priority={2} className="whitespace-nowrap">
                        {overdue
                          ? <Attention>Overdue · {formatDue(lead.firstResponseDueAt as string)}</Attention>
                          : <span className="text-muted-foreground">{lead.firstResponseDueAt ? formatDue(lead.firstResponseDueAt) : 'Sin plazo'}</span>}
                      </Td>
                      <Td className="text-right">
                        {lead.phone ? (
                          <Pill asChild size="sm" className="h-10 md:h-7" onClick={event => event.stopPropagation()}>
                            <a href={`tel:${lead.phone}`} aria-label={`Llamar a ${personName(lead.firstName, lead.lastName, 'lead')}`}><Phone />Llamar</a>
                          </Pill>
                        ) : lead.email ? (
                          <Pill asChild size="sm" className="h-10 md:h-7" onClick={event => event.stopPropagation()}>
                            <a href={`mailto:${lead.email}`} aria-label={`Escribir a ${personName(lead.firstName, lead.lastName, 'lead')}`}><Mail />Email</a>
                          </Pill>
                        ) : null}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </DeskTable>
          )}
        </DeskSection>

        <section aria-labelledby="crm-all-leads" className="min-w-0 space-y-3">
          <h2 id="crm-all-leads" className="sr-only">Todas las consultas</h2>
          <Segmented
            label="Estado de la consulta"
            value={filters.status}
            onChange={value => update({ status: value })}
            options={statusOptions}
            className="max-md:[&_button]:h-10"
          />
          <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-0 lg:max-w-xs lg:flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o teléfono"
                value={searchInput}
                onChange={event => setSearchInput(event.target.value)}
                className="h-10 rounded-[4px] pl-9 text-[13px] lg:h-9"
                aria-label="Buscar consultas"
              />
            </div>
            <div className="grid min-w-0 grid-cols-3 gap-2 lg:flex">
              <Select value={filters.ownerId} onValueChange={value => update({ ownerId: value })}>
                <SelectTrigger className={`${FILTER_TRIGGER} lg:w-[170px]`} aria-label="Filtrar por responsable"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los responsables</SelectItem>
                  {viewer && <SelectItem value={viewer.id}>Mías</SelectItem>}
                  <SelectItem value="unassigned">Sin asignar</SelectItem>
                  {staff.filter(person => person.id !== viewer?.id).map(person => (
                    <SelectItem key={person.id} value={person.id}>{person.name || 'Unnamed'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.source} onValueChange={value => update({ source: value })}>
                <SelectTrigger className={`${FILTER_TRIGGER} lg:w-[150px]`} aria-label="Filtrar por origen"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los orígenes</SelectItem>
                  {LEAD_SOURCES.map(source => <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filters.sort} onValueChange={value => update({ sort: value })}>
                <SelectTrigger className={`${FILTER_TRIGGER} lg:w-[170px]`} aria-label="Ordenar consultas"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Más nuevas primero</SelectItem>
                  <SelectItem value="oldest">Más antiguas primero</SelectItem>
                  <SelectItem value="sla">Por vencimiento de respuesta</SelectItem>
                  <SelectItem value="last-contact">Contacto reciente</SelectItem>
                  <SelectItem value="updated">Actualizadas recientemente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading && !data ? (
            <Panel className="divide-y" aria-busy="true">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="space-y-2 px-4 py-3">
                  <div className="h-3.5 w-40 animate-pulse rounded-[2px] bg-muted" />
                  <div className="h-3 w-64 max-w-full animate-pulse rounded-[2px] bg-muted" />
                </div>
              ))}
            </Panel>
          ) : error ? (
            <Notice tone="bad">
              <p className="font-medium">No se pudieron cargar las consultas</p>
              <p className="mt-0.5 text-muted-foreground">{error}</p>
              <Track className="mt-2">
                <Pill size="sm" onClick={() => load(filters)}>Reintentar</Pill>
              </Track>
            </Notice>
          ) : !data || data.leads.length === 0 ? (
            <Panel className="flex flex-col items-center gap-3 px-4 py-12 text-center">
              <p className="text-sm text-muted-foreground">{isFiltered ? 'No hay consultas que coincidan' : 'No hay consultas'}</p>
              <Track>
                {isFiltered && <Pill size="sm" className="max-md:h-10" onClick={resetFilters}>Limpiar filtros</Pill>}
                {canCreate && <Pill size="sm" variant="primary" className="max-md:h-10" onClick={openCreate}><Plus />Nueva consulta</Pill>}
              </Track>
            </Panel>
          ) : (
            <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={loading}>
              <DeskTable aria-label="Consultas">
                <thead>
                  <tr>
                    <Th>Consulta</Th>
                    <Th>Estado</Th>
                    <Th priority={3}>Origen</Th>
                    <Th priority={2}>Vehículo</Th>
                    <Th priority={2}>Responsable</Th>
                    <Th priority={3}>Actividad</Th>
                    <Th priority={2}>Próximo paso</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.leads.map(lead => {
                    const stage = leadStatus(lead.status)
                    const step = nextStep(lead)
                    const vehicle = vehicleLabel(lead)
                    const activity = lead.lastContact ? `Contacted ${formatAge(lead.lastContact)}` : `Created ${formatAge(lead.createdAt)}`
                    const hot = lead.timeframe === 'immediately' && !isClosed(lead.status)
                    return (
                      <Tr key={lead.id} className="cursor-pointer" onClick={() => openLead(lead.id)}>
                        <Td className="min-w-0 max-w-[16rem]">
                          <Link href={`${basePath}/platform/crm/${lead.id}`} onClick={event => event.stopPropagation()} className="font-medium text-foreground hover:underline">
                            {lead.firstName} {lead.lastName}
                          </Link>
                          {hot && <span className="ml-2 text-[12px] font-medium text-red-700 dark:text-red-300">Caliente</span>}
                          <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                            {[lead.email, formatPhone(lead.phone), lead.timeframe && lead.timeframe !== 'immediately' ? timeframeLabel(lead.timeframe) : null].filter(Boolean).join(' · ')}
                          </p>
                          <p className="truncate text-xs md:hidden">
                            {step.bad ? <Attention>{step.label}</Attention> : <span className="text-muted-foreground">{step.label}</span>}
                          </p>
                        </Td>
                        <Td><Status tone={stage.tone}>{stage.label}</Status></Td>
                        <Td priority={3} className="text-muted-foreground">{sourceLabel(lead.source)}</Td>
                        <Td priority={2} className="text-muted-foreground">{vehicle || '-'}</Td>
                        <Td priority={2} className={lead.assignedSalesperson ? 'text-foreground' : 'text-muted-foreground'}>{lead.assignedSalesperson?.name || 'Sin asignar'}</Td>
                        <Td priority={3} className="whitespace-nowrap text-muted-foreground">{activity}</Td>
                        <Td priority={2} className="whitespace-nowrap">
                          {step.bad ? <Attention>{step.label}</Attention> : <span className="text-muted-foreground">{step.label}</span>}
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </DeskTable>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs tabular-nums text-muted-foreground">{pageStart}-{pageEnd} of {total}</p>
                <Track>
                  <Pill size="sm" className="h-10 sm:h-7" disabled={filters.page === 0 || loading} onClick={() => update({ page: filters.page - 1 })} aria-label="Página anterior"><ChevronLeft /></Pill>
                  <Pill size="sm" className="h-10 sm:h-7" disabled={pageEnd >= total || loading} onClick={() => update({ page: filters.page + 1 })} aria-label="Página siguiente"><ChevronRight /></Pill>
                </Track>
              </div>
            </div>
          )}
        </section>

        <ReadoutStrip>
          <Readout label="Abierta" value={counts?.open ?? '-'} />
          <Readout label="Respuesta vencida" value={counts?.overdue ?? '-'} tone={(counts?.overdue ?? 0) > 0 ? 'bad' : 'idle'} />
          <Readout label="Nueva" value={counts?.new ?? '-'} tone={(counts?.new ?? 0) > 0 ? 'info' : 'idle'} />
          <Readout
            label="Convertida"
            value={counts?.converted ?? '-'}
            tone={(counts?.converted ?? 0) > 0 ? 'ok' : 'idle'}
            sub={counts && counts.all > 0 ? `${Math.round((counts.converted / counts.all) * 100)}% conversion` : undefined}
          />
        </ReadoutStrip>
      </div>

      <LeadFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialValues={{ ...EMPTY_LEAD_FORM, rooftopId: rooftopForCreate }}
        rooftops={rooftops}
        vehicles={vehicles}
        loadStaff={getRooftopStaff}
        onSubmit={submitCreate}
      />
    </PageContainer>
  )
}
