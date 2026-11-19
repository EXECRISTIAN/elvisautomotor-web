'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Phone, RefreshCw } from 'lucide-react'
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
  type DeskTone,
} from '@/features/platform/components/desk'
import { formatPhone } from '@/features/platform/lib/format'
import { completeLeadTask, getTaskQueue, type CrmPerson, type CrmViewer, type TaskQueueFilters, type TaskQueueItem } from '../actions'
import { PRIORITY_TONE, formatDateTime, formatElapsed, leadStatus, personName, zonedDayBounds } from '../lib/leadOptions'

type QueueData = { tasks: TaskQueueItem[]; counts: Record<TaskQueueFilters['bucket'], number> }

const BUCKETS: ReadonlyArray<{ value: TaskQueueFilters['bucket']; label: string; tone?: DeskTone }> = [
  { value: 'overdue', label: 'Vencida', tone: 'bad' },
  { value: 'today', label: 'Vence hoy', tone: 'warn' },
  { value: 'upcoming', label: 'Próximas', tone: 'info' },
  { value: 'no-date', label: 'Sin fecha' },
  { value: 'completed', label: 'Completadas (7 días)', tone: 'ok' },
]

const capitalize = (value: string | null | undefined) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : '')

function isTaskOverdue(task: TaskQueueItem) {
  return !task.completed && Boolean(task.dueDate && new Date(task.dueDate).getTime() < Date.now())
}

function taskStatus(task: TaskQueueItem): { tone: DeskTone; label: string } {
  if (task.completed) return { tone: 'ok', label: 'Completada' }
  if (isTaskOverdue(task)) return { tone: 'bad', label: 'Vencida' }
  return { tone: PRIORITY_TONE[task.priority || ''] ?? 'idle', label: capitalize(task.priority) || 'Abierta' }
}

export function TaskQueuePageClient({
  viewer,
  staff,
  initialFilters,
  initialData,
  initialDueToday = null,
  initialError,
  timeZone,
}: {
  viewer: CrmViewer | null
  staff: CrmPerson[]
  initialFilters: TaskQueueFilters
  initialData: QueueData | null
  initialDueToday?: TaskQueueItem[] | null
  initialError: string | null
  timeZone: string
}) {
  const [filters, setFilters] = useState<TaskQueueFilters>(initialFilters)
  const [data, setData] = useState<QueueData | null>(initialData)
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)
  const [dueToday, setDueToday] = useState<TaskQueueItem[] | null>(initialDueToday)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: DeskTone; text: string } | null>(null)
  const firstLoad = useRef(true)
  const requestId = useRef(0)

  const load = useCallback(async (next: TaskQueueFilters) => {
    if (!viewer) return
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    const { start, end } = zonedDayBounds(timeZone)
    const response = await getTaskQueue({ ...next, todayStart: start, todayEnd: end }, viewer.id)
    if (id !== requestId.current) return
    if (response.success) setData(response.data)
    else setError(response.error || 'No se pudieron cargar las tareas')
    setLoading(false)
  }, [viewer, timeZone])

  const loadDueToday = useCallback(async () => {
    if (!viewer) return
    const { start, end } = zonedDayBounds(timeZone)
    const base: TaskQueueFilters = { bucket: 'overdue', scope: 'mine', assigneeId: 'all', todayStart: start, todayEnd: end }
    const [overdue, today] = await Promise.all([getTaskQueue(base, viewer.id), getTaskQueue({ ...base, bucket: 'today' }, viewer.id)])
    setDueToday(overdue.success && today.success ? [...overdue.data.tasks, ...today.data.tasks] : null)
  }, [viewer, timeZone])

  useEffect(() => {
    if (firstLoad.current) { firstLoad.current = false; return }
    load(filters)
  }, [filters, load])

  const refreshAll = () => {
    load(filters)
    loadDueToday()
  }

  const complete = async (task: TaskQueueItem) => {
    setBusyId(task.id)
    setNotice(null)
    const response = await completeLeadTask(task.lead?.id || null, task.id)
    if (!response.success) setNotice({ tone: 'bad', text: `No se pudo completar la tarea: ${response.error}` })
    await Promise.all([load(filters), loadDueToday()])
    setBusyId(null)
  }

  const canViewAll = viewer?.canViewAllLeads === true
  const canComplete = viewer?.canManageTasks === true
  const counts = data?.counts
  const breadcrumbs = [
    { type: 'link' as const, label: 'Inicio', href: basePath },
    { type: 'page' as const, label: 'Gestión' },
    { type: 'link' as const, label: 'Consultas', href: `${basePath}/platform/crm` },
    { type: 'page' as const, label: 'Tareas' },
  ]

  const header = (
    <DeskHeader
      title={filters.scope === 'mine' ? 'Mis tareas' : 'Tareas del equipo'}
      tone={error ? 'bad' : (counts?.overdue ?? 0) > 0 ? 'bad' : (counts?.today ?? 0) > 0 ? 'warn' : 'ok'}
      status={error ? 'No disponible' : (counts?.overdue ?? 0) > 0 ? `${counts?.overdue} vencidas` : 'Nada vencido'}
      meta={counts ? `${counts.overdue} vencidas · ${counts.today} para hoy · ${counts.upcoming} próximas` : undefined}
      actions={
        <Pill variant="plain" className="max-md:h-10" onClick={refreshAll} disabled={loading} aria-label="Actualizar"><RefreshCw className={loading ? 'animate-spin' : undefined} /></Pill>
      }
    />
  )

  const completeButton = (task: TaskQueueItem, primary = false) => (
    <Pill
      size="sm"
      variant={primary ? 'primary' : 'raised'}
      className="h-10 md:h-7"
      onClick={event => { event.stopPropagation(); complete(task) }}
      disabled={!canComplete || busyId !== null}
      title={canComplete ? undefined : 'Requiere permiso de tareas'}
      aria-label={`Complete ${task.title || 'task'}`}
    >
      <Check />{busyId === task.id ? 'Guardando…' : 'Completar'}
    </Pill>
  )

  const leadCell = (task: TaskQueueItem) => task.lead ? (
    <>
      <Link href={`${basePath}/platform/crm/${task.lead.id}`} className="font-medium text-foreground hover:underline">
        {personName(task.lead.firstName, task.lead.lastName, 'Consulta')}
      </Link>
      <span className="text-muted-foreground"> · {leadStatus(task.lead.status).label}</span>
    </>
  ) : <span className="text-muted-foreground">Sin consulta</span>

  const now = Date.now()

  return (
    <PageContainer title="Tareas" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-8 px-4 pb-24 md:px-6">
        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

        {viewer && (
          <DeskSection id="tasks-due-today" title="Vence hoy" count={dueToday?.length}>
            {dueToday === null ? (
              <Notice tone="bad">No se pudieron cargar las tareas de hoy</Notice>
            ) : dueToday.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Nada vence hoy</p>
            ) : (
              <DeskTable aria-label="Mis tareas de hoy">
                <thead>
                  <tr>
                    <Th align="right" className="w-24">Vence</Th>
                    <Th>Tarea</Th>
                    <Th priority={2}>Consulta</Th>
                    <Th className="w-0"><span className="sr-only">Acciones</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {dueToday.map(task => {
                    const overdue = isTaskOverdue(task)
                    return (
                      <Tr key={task.id}>
                        <Td align="right" className="whitespace-nowrap">
                          {overdue && task.dueDate ? (
                            <>
                              <Figure size="sm" attention>{formatElapsed(Date.parse(task.dueDate), now)}</Figure>
                              <span className="block text-xs text-muted-foreground">overdue</span>
                            </>
                          ) : (
                            <Figure size="sm">{task.dueDate ? new Date(task.dueDate).toLocaleTimeString('es-AR', { timeZone, hour: 'numeric', minute: '2-digit' }) : '-'}</Figure>
                          )}
                        </Td>
                        <Td className="min-w-0">
                          <p className="break-words font-medium text-foreground">{task.title || 'Untitled task'}</p>
                          <p className="text-xs text-muted-foreground">
                            {overdue ? <Attention>Vencida</Attention> : null}
                            {overdue ? ' ' : ''}
                            {[capitalize(task.priority), task.description].filter(Boolean).join(' · ')}
                          </p>
                          <p className="text-xs md:hidden">{leadCell(task)}</p>
                        </Td>
                        <Td priority={2} className="min-w-0">{leadCell(task)}</Td>
                        <Td>
                          <div className="flex flex-wrap justify-end gap-2">
                            {task.lead?.phone && (
                              <Pill asChild size="sm" className="h-10 md:h-7">
                                <a href={`tel:${task.lead.phone}`} aria-label={`Llamar a ${personName(task.lead.firstName, task.lead.lastName, 'lead')} at ${formatPhone(task.lead.phone)}`}><Phone />Llamar</a>
                              </Pill>
                            )}
                            {completeButton(task, true)}
                          </div>
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </DeskTable>
            )}
          </DeskSection>
        )}

        <section aria-labelledby="tasks-all" className="min-w-0 space-y-3">
          <h2 id="tasks-all" className="text-[15px] font-semibold text-foreground">Todas las tareas</h2>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Segmented
              label="Responsable"
              value={filters.scope}
              onChange={scope => setFilters(prev => ({ ...prev, scope, assigneeId: 'all' }))}
              options={[
                { value: 'mine', label: 'Mías' },
                { value: 'all', label: 'Todo el personal', disabled: !canViewAll },
              ]}
              className="max-md:[&_button]:h-10"
            />
            {!canViewAll && <p className="text-xs text-muted-foreground">Ver todo el personal requiere permiso para ver todas las consultas</p>}
            {filters.scope === 'all' && (
              <Select value={filters.assigneeId} onValueChange={assigneeId => setFilters(prev => ({ ...prev, assigneeId }))}>
                <SelectTrigger className="h-10 w-full rounded-[4px] text-[13px] sm:h-9 sm:w-[200px]" aria-label="Filtrar por responsable"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {staff.map(person => <SelectItem key={person.id} value={person.id}>{person.name || 'Unnamed'}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <Segmented
            label="Vence"
            value={filters.bucket}
            onChange={bucket => setFilters(prev => ({ ...prev, bucket }))}
            options={BUCKETS.map(bucket => ({ ...bucket, count: counts?.[bucket.value] }))}
            className="max-md:[&_button]:h-10"
          />

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
              <p className="font-medium">No se pudieron cargar las tareas</p>
              <p className="mt-0.5 text-muted-foreground">{error}</p>
              <Track className="mt-2"><Pill size="sm" onClick={() => load(filters)}>Reintentar</Pill></Track>
            </Notice>
          ) : !data || data.tasks.length === 0 ? (
            <Panel className="px-4 py-12 text-center text-sm text-muted-foreground">Sin tareas</Panel>
          ) : (
            <div className={loading ? 'opacity-60' : undefined} aria-busy={loading}>
              <DeskTable aria-label="Tareas">
                <thead>
                  <tr>
                    <Th>Tarea</Th>
                    <Th>Estado</Th>
                    <Th priority={2}>{filters.bucket === 'completed' ? 'Completada' : 'Vence'}</Th>
                    <Th priority={2}>Consulta</Th>
                    {filters.scope === 'all' && <Th priority={3}>Asignada a</Th>}
                    <Th className="w-0"><span className="sr-only">Acciones</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {data.tasks.map(task => {
                    const status = taskStatus(task)
                    const when = task.completed
                      ? formatDateTime(task.completedDate, timeZone)
                      : task.dueDate ? formatDateTime(task.dueDate, timeZone) : 'Sin vencimiento'
                    return (
                      <Tr key={task.id}>
                        <Td className="min-w-0">
                          <p className={`break-words font-medium ${task.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{task.title || 'Untitled task'}</p>
                          {task.description && <p className="break-words text-xs text-muted-foreground">{task.description}</p>}
                          <p className="text-xs text-muted-foreground md:hidden">{when}</p>
                          <p className="text-xs md:hidden">{leadCell(task)}</p>
                        </Td>
                        <Td><Status tone={status.tone}>{status.label}</Status></Td>
                        <Td priority={2} className="whitespace-nowrap tabular-nums text-muted-foreground">{when}</Td>
                        <Td priority={2} className="min-w-0">
                          {leadCell(task)}
                          {task.lead?.phone && <p className="text-xs tabular-nums text-muted-foreground">{formatPhone(task.lead.phone)}</p>}
                        </Td>
                        {filters.scope === 'all' && <Td priority={3} className="text-muted-foreground">{task.assignedTo?.name || 'Sin asignar'}</Td>}
                        <Td className="text-right">{!task.completed && completeButton(task)}</Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </DeskTable>
            </div>
          )}
        </section>

        <ReadoutStrip>
          <Readout label="Vencida" value={counts?.overdue ?? '-'} tone={(counts?.overdue ?? 0) > 0 ? 'bad' : 'idle'} />
          <Readout label="Vence hoy" value={counts?.today ?? '-'} tone={(counts?.today ?? 0) > 0 ? 'warn' : 'idle'} />
          <Readout label="Próximas" value={counts?.upcoming ?? '-'} />
          <Readout label="Completadas (7 días)" value={counts?.completed ?? '-'} tone={(counts?.completed ?? 0) > 0 ? 'ok' : 'idle'} />
        </ReadoutStrip>
      </div>
    </PageContainer>
  )
}
