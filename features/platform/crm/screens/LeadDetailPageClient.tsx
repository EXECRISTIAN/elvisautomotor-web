'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowRightLeft, CalendarPlus, Check, Mail, Pencil, Phone, RefreshCw, Route } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { OperatorActionDialog } from '@/features/platform/components/OperatorActionDialog'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import {
  Attention,
  Code,
  DeskHeader,
  DeskSection,
  Facts,
  Notice,
  Panel,
  Pill,
  TitleLine,
  Track,
  type DeskTone,
} from '@/features/platform/components/desk'
import { formatPhone } from '@/features/platform/lib/format'
import {
  type CrmPerson,
  type CrmVehicleOption,
  type CrmViewer,
  type LeadDetail,
  advanceLeadCadence,
  completeLeadTask,
  createLeadTask,
  enrollLeadCadence,
  getCustomerDuplicateCount,
  getLead,
  getLeadVehicleOptions,
  manageSalesVisit,
  recordLeadInteraction,
  routeLead,
  transferLeadOwnership,
  transitionLead,
  updateCustomerCommunicationPreferences,
  updateLeadDetails,
} from '../actions'
import {
  CLOSED_LEAD_STATUSES,
  LEAD_STATUSES,
  LEAD_TRANSITIONS,
  PRIORITY_TONE,
  VISIT_ACTIONS,
  VISIT_OUTCOMES,
  VISIT_STATUSES,
  budgetLabel,
  formatDateTime,
  fromZonedInputValue,
  leadStatus,
  sourceLabel,
  timeframeLabel,
} from '../lib/leadOptions'
import { LeadFormDialog, type LeadFormValues } from '../components/LeadFormDialog'
import { TransferLeadDialog } from '../components/TransferLeadDialog'
import { SalesVisitDialog, type VisitDialogAction } from '../components/SalesVisitDialog'
import { FormField } from '../components/FormField'

type Lead = LeadDetail
type Visit = Lead['salesVisits'][number]

const lostReasonOptions = [
  { value: 'purchased-elsewhere', label: 'Compró en otro lado' },
  { value: 'price', label: 'Precio' },
  { value: 'financing', label: 'Financiación' },
  { value: 'vehicle-unavailable', label: 'Vehículo no disponible' },
  { value: 'no-response', label: 'Sin respuesta' },
  { value: 'timing', label: 'Momento' },
  { value: 'other', label: 'Otro' },
]

const dealTone: Record<string, DeskTone> = { pencil: 'idle', submitted: 'warn', approved: 'info', financed: 'info', delivered: 'ok', cancelled: 'bad' }

const VISIT_ACTION_LABEL: Record<string, string> = { arrive: 'Registrar llegada', 'manager-turn': 'Pase al gerente', complete: 'Completar', cancel: 'Cancelar', 'no-show': 'Ausente' }

const ROUTE_LABEL: Record<string, string> = { 'manual-transfer': 'Transferir', 'manual-intake': 'Asignado al ingresar', 'intake-creator': 'Personal de recepción' }

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value || 0)
}

function leadName(lead: Lead) {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Consulta sin nombre'
}

function vehicleName(vehicle: { year: number | null; make: string | null; model: string | null } | null) {
  if (!vehicle) return 'Sin vehículo'
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
}

function consentLabel(suppressed: boolean | null | undefined, consent: boolean | null | undefined) {
  return suppressed ? 'Bloqueado' : consent ? 'Aceptó' : 'No aceptó'
}

const label = (value: string | null | undefined) => (value ? value.replaceAll('-', ' ') : '-')

function leadFormValues(lead: Lead): LeadFormValues {
  return {
    firstName: lead.firstName || '',
    lastName: lead.lastName || '',
    email: lead.email || '',
    phone: lead.phone || '',
    source: lead.source || 'walk-in',
    budgetRange: lead.budgetRange || '',
    timeframe: lead.timeframe || '',
    tradeInVehicle: lead.tradeInVehicle || '',
    notes: lead.notes || '',
    interestedVehicleId: lead.interestedVehicle?.id || '',
    rooftopId: lead.rooftop.id,
    assignedToId: '',
  }
}

export function LeadDetailPageClient({
  id,
  initialLead,
  initialDuplicateCount,
  viewer,
  staff,
  initialError,
  timeZone,
}: {
  id: string
  initialLead: Lead | null
  initialDuplicateCount: number
  viewer: CrmViewer | null
  staff: CrmPerson[]
  initialError: string | null
  timeZone: string
}) {
  const interactionKeyRef = useRef(`lead-interaction:${crypto.randomUUID()}`)
  const [lead, setLead] = useState<Lead | null>(initialLead)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [notice, setNotice] = useState<{ tone: DeskTone; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [duplicateCount, setDuplicateCount] = useState(initialDuplicateCount)
  const [interaction, setInteraction] = useState({ interactionType: 'phone', outcome: 'positive', notes: '', followUpDate: '' })
  const [interactionError, setInteractionError] = useState<string | null>(null)
  const [task, setTask] = useState({ title: '', description: '', dueDate: '', priority: 'medium', communicationChannel: 'internal', assignedToId: '' })
  const [taskError, setTaskError] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [contactChannel, setContactChannel] = useState(initialLead?.customer?.preferredChannel || 'none')
  const [cadence, setCadence] = useState({
    cadenceKey: initialLead?.cadenceKey || 'internet-lead-first-response',
    campaignKey: initialLead?.campaignKey || 'website-organic',
  })
  const [lostReasonDialogOpen, setLostReasonDialogOpen] = useState(false)
  const [lostReasonValues, setLostReasonValues] = useState({ lostReasonCode: '', lostReasonDetails: '' })
  const [lostReasonError, setLostReasonError] = useState<string | null>(null)
  const lostReasonIdempotencyKeyRef = useRef<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const editKeyRef = useRef<string | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const transferKeyRef = useRef<string | null>(null)
  const [visitDialog, setVisitDialog] = useState<{ action: VisitDialogAction; visit?: Visit } | null>(null)
  const visitKeyRef = useRef<string | null>(null)
  const [vehicles, setVehicles] = useState<CrmVehicleOption[]>([])

  const canManage = viewer?.canManageLeads === true
  const canTasks = viewer?.canManageTasks === true
  const manageReason = canManage ? undefined : 'Requiere permiso de gestión de consultas'

  const loadLead = async (quiet = false) => {
    if (!quiet) setLoading(true)
    setError(null)
    const response = await getLead(id)
    if (response.success && response.data?.lead) {
      const loaded = response.data.lead
      setLead(loaded)
      setContactChannel(loaded.customer?.preferredChannel || 'none')
      setCadence({ cadenceKey: loaded.cadenceKey || 'internet-lead-first-response', campaignKey: loaded.campaignKey || 'website-organic' })
      setDuplicateCount(loaded.customer?.id ? await getCustomerDuplicateCount(loaded.customer.id) : 0)
    } else {
      setLead(null)
      setError(response.success ? 'No se encontró esta consulta.' : response.error)
    }
    setLoading(false)
  }

  const ensureVehicles = async () => {
    if (vehicles.length === 0) setVehicles(await getLeadVehicleOptions())
  }

  const runCommand = async (work: () => Promise<{ success: boolean; error?: string }>, failure: string, success?: string) => {
    setSaving(true)
    setNotice(null)
    const response = await work()
    if (!response.success) setNotice({ tone: 'bad', text: `${failure}: ${response.error}` })
    else if (success) setNotice({ tone: 'ok', text: success })
    await loadLead(true)
    setSaving(false)
    return response.success
  }

  const updateLeadStatus = async (status: string) => {
    if (status === 'closed-lost') {
      setLostReasonValues({ lostReasonCode: '', lostReasonDetails: '' })
      setLostReasonError(null)
      lostReasonIdempotencyKeyRef.current = `lead-transition:${id}:${status}:${crypto.randomUUID()}`
      setLostReasonDialogOpen(true)
      return
    }
    await runCommand(() => transitionLead({ id, toStatus: status, idempotencyKey: `lead-transition:${id}:${status}:${crypto.randomUUID()}` }), 'No se pudo actualizar el estado')
  }

  const submitLostLeadTransition = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!lostReasonValues.lostReasonCode) { setLostReasonError('Elegí el motivo de pérdida'); return }
    if (!lostReasonIdempotencyKeyRef.current) return
    setSaving(true)
    setLostReasonError(null)
    const response = await transitionLead({
      id,
      toStatus: 'closed-lost',
      lostReasonCode: lostReasonValues.lostReasonCode,
      lostReasonDetails: lostReasonValues.lostReasonDetails.trim(),
      idempotencyKey: lostReasonIdempotencyKeyRef.current,
    })
    if (!response.success) {
      setLostReasonError(response.error)
      setSaving(false)
      return
    }
    lostReasonIdempotencyKeyRef.current = null
    setLostReasonDialogOpen(false)
    await loadLead(true)
    setSaving(false)
  }

  const handleLostReasonDialogOpenChange = (open: boolean) => {
    setLostReasonDialogOpen(open)
    if (!open) {
      lostReasonIdempotencyKeyRef.current = null
      setLostReasonError(null)
      setLostReasonValues({ lostReasonCode: '', lostReasonDetails: '' })
    }
  }

  const logInteraction = async () => {
    if (!interaction.notes.trim()) { setInteractionError('Las notas son obligatorias'); return }
    const followUp = interaction.followUpDate ? fromZonedInputValue(interaction.followUpDate, timeZone) : null
    if (interaction.followUpDate && !followUp) { setInteractionError('La fecha de seguimiento no es válida'); return }
    setInteractionError(null)
    const ok = await runCommand(() => recordLeadInteraction({
      leadId: id,
      idempotencyKey: interactionKeyRef.current,
      interactionType: interaction.interactionType,
      outcome: interaction.outcome,
      notes: interaction.notes,
      date: new Date().toISOString(),
      ...(followUp ? { followUpDate: followUp } : {}),
    }), 'No se pudo registrar la actividad')
    if (ok) {
      setInteraction({ interactionType: 'phone', outcome: 'positive', notes: '', followUpDate: '' })
      interactionKeyRef.current = `lead-interaction:${crypto.randomUUID()}`
    }
  }

  const applyRoutingRule = async () => {
    if (!lead) return
    await runCommand(() => routeLead({ leadId: lead.id, expectedUpdatedAt: lead.updatedAt, idempotencyKey: `crm-route:${lead.id}:${lead.updatedAt}` }), 'No se pudo asignar la consulta', 'Lead routed')
  }

  const createTask = async () => {
    if (!task.title.trim()) { setTaskError('El título es obligatorio'); return }
    const due = task.dueDate ? fromZonedInputValue(task.dueDate, timeZone) : null
    if (task.dueDate && !due) { setTaskError('La fecha de vencimiento no es válida'); return }
    setTaskError(null)
    const ok = await runCommand(() => createLeadTask({
      leadId: id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      communicationChannel: task.communicationChannel,
      idempotencyKey: `crm-task:${id}:${crypto.randomUUID()}`,
      ...(due ? { dueDate: due } : {}),
      ...(task.assignedToId ? { assignedToId: task.assignedToId } : {}),
    }), 'No se pudo crear la tarea')
    if (ok) setTask({ title: '', description: '', dueDate: '', priority: 'medium', communicationChannel: 'internal', assignedToId: '' })
  }

  const saveContactPreference = async (suppressSelected = false) => {
    if (!lead?.customer) return
    const selected = contactChannel
    if (suppressSelected && selected === 'none') { setNotice({ tone: 'bad', text: 'Elegí el canal a bloquear' }); return }
    const customer = lead.customer
    await runCommand(() => updateCustomerCommunicationPreferences(lead.id, {
      customerId: customer.id,
      expectedUpdatedAt: customer.updatedAt,
      emailConsent: selected === 'email' ? true : customer.emailConsent === true,
      smsConsent: selected === 'sms' ? true : customer.smsConsent === true,
      phoneConsent: selected === 'phone' ? true : customer.phoneConsent === true,
      emailSuppressed: suppressSelected && selected === 'email' ? true : customer.emailSuppressed === true,
      smsSuppressed: suppressSelected && selected === 'sms' ? true : customer.smsSuppressed === true,
      phoneSuppressed: suppressSelected && selected === 'phone' ? true : customer.phoneSuppressed === true,
      preferredChannel: suppressSelected ? 'none' : selected,
      source: 'operator-recorded',
      reason: suppressSelected ? `Customer requested ${selected} suppression` : `Customer confirmed ${selected} preference`,
      idempotencyKey: `crm-preference:${customer.id}:${crypto.randomUUID()}`,
    }), 'No se pudieron actualizar las preferencias')
  }

  const enrollCadence = async () => {
    if (!lead) return
    await runCommand(() => enrollLeadCadence({
      leadId: lead.id,
      expectedUpdatedAt: lead.updatedAt,
      cadenceKey: cadence.cadenceKey,
      campaignKey: cadence.campaignKey,
      idempotencyKey: `crm-cadence:${lead.id}:${crypto.randomUUID()}`,
    }), 'No se pudo inscribir en la secuencia')
  }

  const advanceCadence = async () => {
    if (!lead) return
    await runCommand(() => advanceLeadCadence({ leadId: lead.id, expectedUpdatedAt: lead.updatedAt, idempotencyKey: `crm-cadence-advance:${lead.id}:${crypto.randomUUID()}` }), 'No se pudo avanzar la secuencia')
  }

  const completeTask = async (taskId: string) => {
    await runCommand(() => completeLeadTask(id, taskId), 'No se pudo completar la tarea')
  }

  const openEdit = async () => {
    editKeyRef.current = `lead-details:${id}:${crypto.randomUUID()}`
    setEditOpen(true)
    await ensureVehicles()
  }

  const submitEdit = async (values: LeadFormValues) => {
    if (!lead) return 'La consulta no está cargada'
    const { rooftopId: _rooftopId, assignedToId: _assignedToId, ...details } = values
    const response = await updateLeadDetails({ ...details, leadId: lead.id, expectedUpdatedAt: lead.updatedAt, idempotencyKey: editKeyRef.current || `lead-details:${id}:${crypto.randomUUID()}` })
    if (!response.success) return response.error
    editKeyRef.current = null
    setEditOpen(false)
    setNotice({ tone: 'ok', text: 'Consulta guardada' })
    await loadLead(true)
    return null
  }

  const openTransfer = () => {
    transferKeyRef.current = `lead-transfer:${id}:${crypto.randomUUID()}`
    setTransferOpen(true)
  }

  const submitTransfer = async (values: { assignedToId: string; reason: string }) => {
    if (!lead) return 'La consulta no está cargada'
    const response = await transferLeadOwnership({ leadId: lead.id, expectedUpdatedAt: lead.updatedAt, idempotencyKey: transferKeyRef.current || `lead-transfer:${id}:${crypto.randomUUID()}`, ...values })
    if (!response.success) return response.error
    transferKeyRef.current = null
    setTransferOpen(false)
    setNotice({ tone: 'ok', text: 'Consulta transferida' })
    await loadLead(true)
    return null
  }

  const openVisit = async (action: VisitDialogAction, visit?: Visit) => {
    visitKeyRef.current = `crm-visit:${visit?.id || id}:${action}:${crypto.randomUUID()}`
    setVisitDialog({ action, visit })
    if (action === 'schedule') await ensureVehicles()
  }

  const submitVisit = async (values: { kind: string; scheduledAtIso: string | null; vehicleId: string; managerId: string; outcome: string; notes: string }) => {
    if (!lead || !visitDialog) return 'La consulta no está cargada'
    const { action, visit } = visitDialog
    const idempotencyKey = visitKeyRef.current || `crm-visit:${crypto.randomUUID()}`
    const response = await manageSalesVisit(lead.id, action === 'schedule'
      ? {
          action,
          leadId: lead.id,
          kind: values.kind,
          ...(values.vehicleId ? { vehicleId: values.vehicleId } : {}),
          ...(values.kind === 'appointment' && values.scheduledAtIso ? { scheduledAt: values.scheduledAtIso } : {}),
          notes: values.notes.trim(),
          idempotencyKey,
        }
      : {
          action,
          visitId: visit?.id,
          expectedUpdatedAt: visit?.updatedAt,
          ...(action === 'manager-turn' ? { managerId: values.managerId } : {}),
          ...(action === 'complete' ? { outcome: values.outcome } : {}),
          notes: values.notes.trim(),
          idempotencyKey,
        })
    if (!response.success) return response.error
    visitKeyRef.current = null
    setVisitDialog(null)
    await loadLead(true)
    return null
  }

  const breadcrumbs = [
    { type: 'link' as const, label: 'Inicio', href: basePath },
    { type: 'page' as const, label: 'Gestión' },
    { type: 'link' as const, label: 'Consultas', href: `${basePath}/platform/crm` },
    { type: 'page' as const, label: lead ? leadName(lead) : 'Consulta' },
  ]

  if (loading) {
    return (
      <PageContainer title="Consultas" breadcrumbs={breadcrumbs}>
        <div className="space-y-3 px-4 pb-24 md:px-6" role="status" aria-label="Cargando consulta">
          <div className="h-7 w-56 max-w-full animate-pulse rounded-[2px] bg-muted" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded-[2px] bg-muted" />
          <div className="h-48 animate-pulse rounded-md bg-muted" />
        </div>
      </PageContainer>
    )
  }

  if (!lead) {
    return (
      <PageContainer title="Consultas" breadcrumbs={breadcrumbs} header={<DeskHeader title="Consulta no disponible" tone="bad" status="No disponible" />}>
        <div className="space-y-3 px-4 pb-24 md:px-6">
          <Notice tone="bad">{error || 'No se encontró esta consulta.'}</Notice>
          <Track>
            <Pill onClick={() => loadLead()}>Reintentar</Pill>
            <Pill asChild><Link href={`${basePath}/platform/crm`}>Volver a consultas</Link></Pill>
          </Track>
        </div>
      </PageContainer>
    )
  }

  const currentStatus = leadStatus(lead.status)
  const openTasks = lead.tasks.filter(item => !item.completed)
  const completedTasks = lead.tasks.filter(item => item.completed)
  const responseOverdue = Boolean(lead.firstResponseDueAt && !lead.firstResponseAt && new Date(lead.firstResponseDueAt).getTime() < Date.now())
  const isClosed = CLOSED_LEAD_STATUSES.includes(lead.status || '')
  const allowedStatuses = LEAD_TRANSITIONS[lead.status || 'new'] || []
  const activeVisits = lead.salesVisits.filter(visit => VISIT_ACTIONS[visit.status || ''])
  const pastVisits = lead.salesVisits.filter(visit => !VISIT_ACTIONS[visit.status || ''])
  const selectSm = 'h-11 rounded-[4px] sm:h-9'
  const nextTask = [...openTasks].sort((a, b) =>
    (a.dueDate ? Date.parse(a.dueDate) : Infinity) - (b.dueDate ? Date.parse(b.dueDate) : Infinity))[0] || null
  const nextTaskOverdue = Boolean(nextTask?.dueDate && Date.parse(nextTask.dueDate) < Date.now())
  const awaitingResponse = !isClosed && !lead.firstResponseAt
  const responseState = lead.firstResponseAt
    ? `Respondida ${formatDateTime(lead.firstResponseAt, timeZone)}`
    : responseOverdue
      ? 'Primera respuesta vencida'
      : lead.firstResponseDueAt ? `Respond by ${formatDateTime(lead.firstResponseDueAt, timeZone)}` : 'Sin respuesta todavía'
  const dealHref = `${basePath}/platform/deals/create?leadId=${lead.id}${lead.interestedVehicle ? `&vehicleId=${lead.interestedVehicle.id}` : ''}`
  // While the lead waits on a first response, reaching the customer is the next action; after that, the deal.
  const contactFirst = awaitingResponse && Boolean(lead.phone || lead.email)

  const header = (
    <DeskHeader
      title={leadName(lead)}
      tone={currentStatus.tone}
      status={currentStatus.label}
      meta={<span>{currentStatus.label} · {responseState} · {lead.assignedSalesperson?.name || 'Sin asignar'} · {sourceLabel(lead.source)} · Creada {formatDateTime(lead.createdAt, timeZone)}</span>}
      actions={
        <>
          <Pill variant="plain" className="max-md:h-10" onClick={() => loadLead()} aria-label="Actualizar"><RefreshCw /></Pill>
          <Pill variant="plain" className="max-md:h-10" onClick={openEdit} disabled={!canManage || saving} title={manageReason}><Pencil />Editar</Pill>
          {lead.email && <Pill asChild className="max-md:h-10" variant={contactFirst && !lead.phone ? 'primary' : 'raised'}><a href={`mailto:${lead.email}`}><Mail />Email</a></Pill>}
          {lead.phone && <Pill asChild className="max-md:h-10" variant={contactFirst ? 'primary' : 'raised'}><a href={`tel:${lead.phone}`}><Phone />Llamar</a></Pill>}
          <Pill asChild className="max-md:h-10" variant={contactFirst ? 'raised' : 'primary'}>
            <Link href={dealHref}>Iniciar operación</Link>
          </Pill>
        </>
      }
    />
  )

  const visitRow = (visit: Visit) => {
    const status = VISIT_STATUSES[visit.status || ''] || { label: label(visit.status), tone: 'idle' as DeskTone }
    const actions = VISIT_ACTIONS[visit.status || ''] || []
    const outcome = VISIT_OUTCOMES.find(item => item.value === visit.outcome)?.label || visit.outcome
    return (
      <div key={visit.id} className="space-y-2 px-3 py-2.5">
        <div className="min-w-0">
          <TitleLine as="p" tone={status.tone} status={status.label} className="text-sm font-medium">
            {visit.kind === 'showroom' ? 'Visita al salón' : 'Cita de venta'} · {status.label}
          </TitleLine>
          <p className="pl-4 text-xs text-muted-foreground">
            {[
              visit.scheduledAt && `Scheduled ${formatDateTime(visit.scheduledAt, timeZone)}`,
              visit.arrivedAt && `Arrived ${formatDateTime(visit.arrivedAt, timeZone)}`,
              visit.managerTurnAt && `T.O. ${formatDateTime(visit.managerTurnAt, timeZone)}${visit.manager?.name ? ` to ${visit.manager.name}` : ''}`,
              visit.completedAt && `Completed ${formatDateTime(visit.completedAt, timeZone)}`,
            ].filter(Boolean).join(' · ')}
          </p>
          <p className="pl-4 text-xs text-muted-foreground">
            {[visit.vehicle ? vehicleName(visit.vehicle) : null, visit.assignedSalesperson?.name, outcome && `Outcome: ${outcome}`].filter(Boolean).join(' · ')}
          </p>
          {visit.notes && <p className="mt-0.5 whitespace-pre-line break-words pl-4 text-xs">{visit.notes}</p>}
        </div>
        {actions.length > 0 && (
          <Track className="ml-4">
            {actions.map(action => (
              <Pill key={action} size="sm" className="h-11 sm:h-7" onClick={() => openVisit(action, visit)} disabled={!canManage || saving} title={manageReason}>
                {VISIT_ACTION_LABEL[action]}
              </Pill>
            ))}
          </Track>
        )}
      </div>
    )
  }

  return (
    <PageContainer title="Consultas" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full px-4 pb-24 md:px-6">
        {responseOverdue && <Notice tone="warn" className="mb-4">First response overdue · due {formatDateTime(lead.firstResponseDueAt, timeZone)}</Notice>}
        {notice && <Notice tone={notice.tone} className="mb-4">{notice.text}</Notice>}
        {!canManage && <p className="mb-4 text-xs text-muted-foreground">Solo lectura · requiere permiso de gestión de consultas</p>}

        <div className="mb-8 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <DeskSection title="Próxima tarea" id="lead-next-task">
            {nextTask ? (
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-foreground">{nextTask.title}</p>
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    {nextTask.dueDate ? (
                      nextTaskOverdue
                        ? <Attention>Overdue · {formatDateTime(nextTask.dueDate, timeZone)}</Attention>
                        : <span>Due {formatDateTime(nextTask.dueDate, timeZone)}</span>
                    ) : <span>Sin vencimiento</span>}
                    <span className="capitalize">{nextTask.priority}</span>
                    {nextTask.assignedTo?.name && <span>{nextTask.assignedTo.name}</span>}
                  </p>
                  {nextTask.description && <p className="mt-1 break-words text-xs text-muted-foreground">{nextTask.description}</p>}
                </div>
                <Pill
                  variant="primary"
                  className="h-10 shrink-0 md:h-8"
                  onClick={() => completeTask(nextTask.id)}
                  disabled={!canTasks || saving}
                  title={canTasks ? undefined : 'Requiere permiso de tareas'}
                  aria-label={`Complete ${nextTask.title || 'task'}`}
                >
                  <Check />Listo
                </Pill>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-[13px] text-muted-foreground">Sin tareas abiertas</p>
                {awaitingResponse && <p className="text-[13px] text-foreground">{responseOverdue ? <Attention>Primera respuesta vencida</Attention> : responseState}</p>}
              </div>
            )}
          </DeskSection>

          <DeskSection title="Contacto" id="lead-contact">
            <div className="grid min-w-0 grid-cols-1 gap-x-8 md:grid-cols-2">
              <Facts items={[
                { label: 'Teléfono', value: lead.phone ? <a className="underline-offset-2 hover:underline" href={`tel:${lead.phone}`}>{formatPhone(lead.phone)}</a> : '-' },
                { label: 'Email', value: lead.email ? <a className="break-all underline-offset-2 hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a> : '-' },
                { label: 'Preferido', value: <span className="capitalize">{lead.customer?.preferredChannel && lead.customer.preferredChannel !== 'none' ? lead.customer.preferredChannel : 'Sin preferencia'}</span> },
                { label: 'Primera respuesta', value: responseOverdue ? <Attention>Vencida</Attention> : lead.firstResponseAt ? `Respondida ${formatDateTime(lead.firstResponseAt, timeZone)}` : lead.firstResponseDueAt ? `Due ${formatDateTime(lead.firstResponseDueAt, timeZone)}` : 'Sin plazo' },
              ]} />
              <Facts items={[
                { label: 'Origen', value: sourceLabel(lead.source) },
                { label: 'Plazo de compra', value: timeframeLabel(lead.timeframe) },
                { label: 'Último contacto', value: formatDateTime(lead.lastContact, timeZone) },
                { label: 'Cliente', value: lead.customer ? (
                  <Link className="underline underline-offset-2" href={`${basePath}/platform/customers/${lead.customer.id}`}>
                    {[lead.customer.firstName, lead.customer.lastName].filter(Boolean).join(' ') || 'Cliente'}
                  </Link>
                ) : 'Sin vincular' },
                duplicateCount > 0 && { label: 'Duplicados', value: (
                  <Link className="text-amber-700 underline underline-offset-2 dark:text-amber-300" href={`${basePath}/platform/customers/${lead.customer?.id}#duplicates`}>
                    {duplicateCount} possible
                  </Link>
                ) },
                lead.customer?.household && { label: 'Grupo familiar', value: lead.customer.household.displayName || '-' },
              ]} />
            </div>
          </DeskSection>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-8">
            <DeskSection title="Actividad" count={lead.interactions.length}>
              {canManage && (
                <Panel className="space-y-2 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={interaction.interactionType} onValueChange={value => setInteraction(prev => ({ ...prev, interactionType: value }))}>
                      <SelectTrigger className={selectSm} aria-label="Tipo de interacción"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="phone">Teléfono</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">Mensaje</SelectItem>
                        <SelectItem value="visit">Visita</SelectItem>
                        <SelectItem value="test-drive">Prueba de manejo</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={interaction.outcome} onValueChange={value => setInteraction(prev => ({ ...prev, outcome: value }))}>
                      <SelectTrigger className={selectSm} aria-label="Resultado"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="positive">Positivo</SelectItem>
                        <SelectItem value="neutral">Neutro</SelectItem>
                        <SelectItem value="negative">Negativo</SelectItem>
                        <SelectItem value="no-answer">No atendió</SelectItem>
                        <SelectItem value="voicemail">Buzón de voz</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    aria-label="Notas de la interacción"
                    aria-invalid={Boolean(interactionError)}
                    value={interaction.notes}
                    onChange={event => { setInteraction(prev => ({ ...prev, notes: event.target.value })); setInteractionError(null) }}
                    placeholder="Notas"
                    className="min-h-20 rounded-[4px]"
                  />
                  {interactionError && <p className="text-xs text-red-600 dark:text-red-400">{interactionError}</p>}
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                      Seguimiento
                      <Input aria-label="Fecha de seguimiento" type="datetime-local" value={interaction.followUpDate} onChange={event => setInteraction(prev => ({ ...prev, followUpDate: event.target.value }))} className="h-11 min-w-0 flex-1 rounded-[4px] sm:h-9 sm:w-56" />
                    </label>
                    <Track className="self-end">
                      <Pill variant="primary" className="h-11 sm:h-8" onClick={logInteraction} disabled={saving}>Registrar actividad</Pill>
                    </Track>
                  </div>
                </Panel>
              )}

              {lead.interactions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin actividad</p>
              ) : (
                <ol className="mt-4 space-y-0">
                  {lead.interactions.map(item => (
                    <li key={item.id} className="relative border-l pb-4 pl-5 last:pb-0">
                      <span className="absolute -left-[4px] top-1.5 size-2 rounded-[1px] bg-muted-foreground/50" aria-hidden="true" />
                      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
                        <p className="text-sm font-medium capitalize">
                          {label(item.interactionType)}
                          <span className="font-normal text-muted-foreground"> · {label(item.outcome)}</span>
                        </p>
                        <p className="text-xs tabular-nums text-muted-foreground">{formatDateTime(item.date, timeZone)}</p>
                      </div>
                      {item.performedBy?.name && <p className="text-xs text-muted-foreground">{item.performedBy.name}</p>}
                      {item.notes && <p className="mt-1 whitespace-pre-line break-words text-sm">{item.notes}</p>}
                      {item.followUpDate && <p className="mt-1 text-xs text-sky-700 dark:text-sky-300">Follow up {formatDateTime(item.followUpDate, timeZone)}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </DeskSection>

            <DeskSection
              title="Tareas"
              count={openTasks.length}
              actions={completedTasks.length > 0 ? (
                <Track>
                  <Pill size="sm" variant="plain" className="max-md:h-10" aria-pressed={showCompleted} onClick={() => setShowCompleted(value => !value)}>{showCompleted ? 'Ocultar' : 'Mostrar'} {completedTasks.length} completed</Pill>
                </Track>
              ) : undefined}
            >
              {openTasks.length > 0 && (
                <Panel className="mb-3 divide-y">
                  {openTasks.map(item => {
                    const overdue = Boolean(item.dueDate && new Date(item.dueDate).getTime() < Date.now())
                    return (
                      <div key={item.id} className="flex min-w-0 items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <TitleLine as="p" tone={overdue ? 'bad' : PRIORITY_TONE[item.priority || ''] ?? 'idle'} status={overdue ? 'Vencida' : item.priority || undefined} className="text-sm font-medium">
                            {item.title}
                          </TitleLine>
                          <p className={`pl-4 text-xs ${overdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                            {item.dueDate ? `${overdue ? 'Vencida' : 'Vence'} ${formatDateTime(item.dueDate, timeZone)}` : 'Sin vencimiento'} · <span className="capitalize">{item.priority}</span>
                            {item.assignedTo?.name ? ` · ${item.assignedTo.name}` : ''}
                          </p>
                          {item.description && <p className="mt-0.5 break-words pl-4 text-xs text-muted-foreground">{item.description}</p>}
                        </div>
                        <Track className="shrink-0">
                          <Pill size="sm" className="h-11 sm:h-7" onClick={() => completeTask(item.id)} disabled={!canTasks || saving} title={canTasks ? undefined : 'Requiere permiso de tareas'} aria-label={`Complete ${item.title || 'task'}`}>
                            <Check />Listo
                          </Pill>
                        </Track>
                      </div>
                    )
                  })}
                </Panel>
              )}
              {openTasks.length === 0 && <p className="pb-3 text-sm text-muted-foreground">Sin tareas abiertas</p>}
              {showCompleted && completedTasks.length > 0 && (
                <Panel className="mb-3 divide-y">
                  {completedTasks.map(item => (
                    <div key={item.id} className="px-4 py-2.5">
                      <TitleLine as="p" tone="ok" status="Completada" className="text-sm text-muted-foreground line-through">{item.title}</TitleLine>
                      <p className="pl-4 text-xs text-muted-foreground">Completed {formatDateTime(item.completedDate, timeZone)}{item.assignedTo?.name ? ` · ${item.assignedTo.name}` : ''}</p>
                    </div>
                  ))}
                </Panel>
              )}

              {canTasks && (
                <Panel className="space-y-2 p-3">
                  <Input aria-label="Título de la tarea" aria-invalid={Boolean(taskError)} className="h-11 rounded-[4px] sm:h-9" value={task.title} onChange={event => { setTask(prev => ({ ...prev, title: event.target.value })); setTaskError(null) }} placeholder="Título de la tarea" maxLength={200} />
                  <Textarea aria-label="Detalle de la tarea" value={task.description} onChange={event => setTask(prev => ({ ...prev, description: event.target.value }))} placeholder="Detalle" className="min-h-16 rounded-[4px]" maxLength={4000} />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input aria-label="Vencimiento" type="datetime-local" value={task.dueDate} onChange={event => setTask(prev => ({ ...prev, dueDate: event.target.value }))} className="h-11 min-w-0 rounded-[4px] sm:h-9" />
                    <Select value={task.assignedToId || '__owner__'} onValueChange={value => setTask(prev => ({ ...prev, assignedToId: value === '__owner__' ? '' : value }))}>
                      <SelectTrigger className={selectSm} aria-label="Asignada a"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__owner__">Responsable</SelectItem>
                        {staff.map(person => <SelectItem key={person.id} value={person.id}>{person.name || 'Unnamed'}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={task.priority} onValueChange={value => setTask(prev => ({ ...prev, priority: value }))}>
                      <SelectTrigger className={selectSm} aria-label="Prioridad"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baja</SelectItem>
                        <SelectItem value="medium">Media</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={task.communicationChannel} onValueChange={value => setTask(prev => ({ ...prev, communicationChannel: value }))}>
                      <SelectTrigger className={selectSm} aria-label="Canal"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal">Interna</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="phone">Teléfono</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {taskError && <p className="text-xs text-red-600 dark:text-red-400">{taskError}</p>}
                  <div className="flex justify-end">
                    <Track><Pill className="h-11 sm:h-8" onClick={createTask} disabled={saving}>Crear tarea</Pill></Track>
                  </div>
                </Panel>
              )}
            </DeskSection>

            <DeskSection
              title="Visitas y citas"
              count={lead.salesVisits.length}
              actions={
                <Track>
                  <Pill size="sm" className="h-11 sm:h-7" onClick={() => openVisit('schedule')} disabled={!canManage || saving || isClosed} title={isClosed ? 'La consulta está cerrada' : manageReason}>
                    <CalendarPlus />Agendar
                  </Pill>
                </Track>
              }
            >
              {lead.salesVisits.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin visitas</p>
              ) : (
                <div className="space-y-3">
                  {activeVisits.length > 0 && <Panel className="divide-y">{activeVisits.map(visitRow)}</Panel>}
                  {pastVisits.length > 0 && <Panel className="divide-y">{pastVisits.map(visitRow)}</Panel>}
                </div>
              )}
            </DeskSection>

            <DeskSection title="Notas">
              <p className="whitespace-pre-line break-words text-sm">{lead.notes || <span className="text-muted-foreground">Sin notas</span>}</p>
            </DeskSection>
          </div>

          <div className="min-w-0 space-y-8">
            <DeskSection title="Estado">
              <div className="space-y-3">
                <Select value={lead.status || 'new'} onValueChange={updateLeadStatus} disabled={saving || !canManage || allowedStatuses.length === 0}>
                  <SelectTrigger aria-label="Estado de la consulta" className={selectSm}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.filter(status => status.value === lead.status || allowedStatuses.includes(status.value)).map(status => (
                      <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isClosed && <p className="text-xs text-muted-foreground">Las consultas cerradas no pueden cambiar de estado</p>}
                {lead.status === 'closed-lost' && (lead.lostReasonCode || lead.lostReason) && (
                  <Facts items={[
                    !!lead.lostReasonCode && { label: 'Motivo de pérdida', value: <span className="capitalize">{label(lead.lostReasonCode)}</span> },
                    !!lead.lostReason && { label: 'Detalle', value: lead.lostReason },
                  ]} />
                )}
              </div>
            </DeskSection>

            <DeskSection
              title="Responsable"
              actions={
                <Track>
                  {!lead.assignedSalesperson && (
                    <Pill size="sm" className="h-11 sm:h-7" onClick={applyRoutingRule} disabled={!canManage || saving} title={manageReason}><Route />Asignar</Pill>
                  )}
                  <Pill size="sm" className="h-11 sm:h-7" onClick={openTransfer} disabled={!canManage || saving} title={manageReason}><ArrowRightLeft />Transferir</Pill>
                </Track>
              }
            >
              <Facts items={[
                { label: 'Vendedor', value: lead.assignedSalesperson?.name || 'Sin asignar' },
                { label: 'Asignado', value: formatDateTime(lead.assignedAt, timeZone) },
                { label: 'Primera respuesta', value: lead.firstResponseAt ? `Respondida ${formatDateTime(lead.firstResponseAt, timeZone)}` : lead.firstResponseDueAt ? `Due ${formatDateTime(lead.firstResponseDueAt, timeZone)}` : 'Sin plazo' },
              ]} />
              <p className="mt-4 text-[12px] font-medium text-muted-foreground">Historial de asignaciones</p>
              {lead.assignmentEvents.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">Sin asignaciones</p>
              ) : (
                <ol className="mt-2 space-y-0">
                  {lead.assignmentEvents.map(event => (
                    <li key={event.id} className="relative border-l pb-3 pl-4 last:pb-0">
                      <span className="absolute -left-[4px] top-1.5 size-2 rounded-[1px] bg-muted-foreground/50" aria-hidden="true" />
                      <p className="text-sm">{event.fromUser?.name ? `${event.fromUser.name} to ` : ''}{event.toUser?.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">
                        {[formatDateTime(event.assignedAt, timeZone), ROUTE_LABEL[event.routeKey || ''] || (event.routeKey ? 'Regla de asignación' : null), event.actor?.name ? `por ${event.actor.name}` : null].filter(Boolean).join(' · ')}
                      </p>
                      {event.reason && <p className="break-words text-xs text-muted-foreground">{event.reason}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </DeskSection>

            <DeskSection title="Vehículo de interés">
              {lead.interestedVehicle ? (
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{vehicleName(lead.interestedVehicle)}</p>
                    <p className="text-xs text-muted-foreground">
                      <Code>#{lead.interestedVehicle.stockNumber}</Code> · <span className="tabular-nums">{formatCurrency(lead.interestedVehicle.price)}</span>
                    </p>
                  </div>
                  <Track className="shrink-0">
                    <Pill size="sm" asChild><Link href={`/inventory/${lead.interestedVehicle.id}`}>Publicación</Link></Pill>
                  </Track>
                </div>
              ) : <p className="text-sm text-muted-foreground">Sin vehículo</p>}
            </DeskSection>

            <DeskSection title="Usado y financiación">
              <Facts items={[
                { label: 'Usado', value: lead.tradeInVehicle || '-' },
                { label: 'Presupuesto', value: budgetLabel(lead.budgetRange) },
              ]} />
              {lead.deals.length > 0 ? (
                <Panel className="mt-3 divide-y">
                  {lead.deals.map(deal => (
                    <Link key={deal.id} href={`${basePath}/platform/deals/${deal.id}`} className="flex min-w-0 items-start justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40">
                      <div className="min-w-0">
                        <TitleLine as="p" tone={dealTone[deal.status || ''] ?? 'idle'} status={deal.status || undefined} className="text-sm font-medium">{vehicleName(deal.vehicle)}</TitleLine>
                        <p className="pl-4 text-xs capitalize text-muted-foreground">{deal.status}</p>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        {deal.structureType === 'cash' ? (
                          <>
                            <p className="text-sm font-medium">{formatCurrency(deal.totalPrice ?? deal.vehiclePrice)}</p>
                            <p className="text-xs text-muted-foreground">Contado</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium">{formatCurrency(deal.vehiclePrice)}</p>
                            <p className="text-xs text-muted-foreground">{deal.monthlyPayment ? `${formatCurrency(deal.monthlyPayment)}/mo` : 'Financiación'}</p>
                          </>
                        )}
                      </div>
                    </Link>
                  ))}
                </Panel>
              ) : <p className="mt-2 text-sm text-muted-foreground">Sin operaciones</p>}
            </DeskSection>

            <DeskSection title="Pruebas de manejo" count={lead.testDrives.length}>
              {lead.testDrives.length > 0 ? (
                <Panel className="divide-y">
                  {lead.testDrives.map(testDrive => {
                    const state = testDrive.completed ? 'Completada' : testDrive.noShow ? 'Ausente' : 'Agendada'
                    return (
                      <div key={testDrive.id} className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-2.5">
                        <TitleLine as="p" tone={testDrive.completed ? 'ok' : testDrive.noShow ? 'bad' : 'info'} status={state} className="text-sm">{vehicleName(testDrive.vehicle)}</TitleLine>
                        <span className="shrink-0 text-right text-xs text-muted-foreground"><span className="tabular-nums">{formatDateTime(testDrive.scheduledTime, timeZone)}</span> · {state}</span>
                      </div>
                    )
                  })}
                </Panel>
              ) : <p className="text-sm text-muted-foreground">Sin pruebas de manejo</p>}
            </DeskSection>

            <DeskSection title="Consentimiento">
              <div className="space-y-3">
                <Facts items={[
                  { label: 'Email', value: consentLabel(lead.customer?.emailSuppressed, lead.customer?.emailConsent) },
                  { label: 'SMS', value: consentLabel(lead.customer?.smsSuppressed, lead.customer?.smsConsent) },
                  { label: 'Teléfono', value: consentLabel(lead.customer?.phoneSuppressed, lead.customer?.phoneConsent) },
                ]} />
                <Select value={contactChannel} onValueChange={setContactChannel} disabled={!lead.customer || saving || !canManage}>
                  <SelectTrigger aria-label="Canal preferido" className={selectSm}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin canal preferido</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="phone">Teléfono</SelectItem>
                  </SelectContent>
                </Select>
                <Track block>
                  <Pill size="sm" className="h-11 sm:h-7" onClick={() => saveContactPreference(false)} disabled={!lead.customer || saving || !canManage} title={manageReason}>Guardar preferencia</Pill>
                  <Pill size="sm" className="h-11 sm:h-7" onClick={() => saveContactPreference(true)} disabled={!lead.customer || contactChannel === 'none' || saving || !canManage} title={manageReason}>Bloquear</Pill>
                </Track>
              </div>
            </DeskSection>

            <DeskSection title="Secuencia">
              <div className="space-y-3">
                <Facts items={[
                  { label: 'Estado', value: <span className="capitalize">{lead.cadenceStatus || 'none'}</span> },
                  !!lead.cadenceStep && { label: 'Paso', value: lead.cadenceStep },
                  !!lead.cadenceDueAt && { label: 'Vence', value: formatDateTime(lead.cadenceDueAt, timeZone) },
                ]} />
                <FormField id="cadence-campaign" label="Campaña">
                  <Input id="cadence-campaign" className="h-11 rounded-[4px] sm:h-9" value={cadence.campaignKey} onChange={event => setCadence(prev => ({ ...prev, campaignKey: event.target.value }))} disabled={!canManage} />
                </FormField>
                <Select value={cadence.cadenceKey} onValueChange={value => setCadence(prev => ({ ...prev, cadenceKey: value }))} disabled={!canManage}>
                  <SelectTrigger aria-label="Secuencia de seguimiento" className={selectSm}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internet-lead-first-response">Primera respuesta web</SelectItem>
                    <SelectItem value="showroom-follow-up">Seguimiento de salón</SelectItem>
                    <SelectItem value="unsold-follow-up">Seguimiento sin venta</SelectItem>
                  </SelectContent>
                </Select>
                <Track block>
                  <Pill size="sm" className="h-11 sm:h-7" onClick={enrollCadence} disabled={saving || isClosed || !canManage} title={isClosed ? 'La consulta está cerrada' : manageReason}>Inscribir</Pill>
                  <Pill size="sm" className="h-11 sm:h-7" onClick={advanceCadence} disabled={saving || lead.cadenceStatus !== 'active' || !canManage} title={lead.cadenceStatus !== 'active' ? 'No active cadence' : manageReason}>Avanzar</Pill>
                </Track>
              </div>
            </DeskSection>
          </div>
        </div>

        <OperatorActionDialog
          open={lostReasonDialogOpen}
          title="Cerrar consulta como perdida"
          fields={[
            { name: 'lostReasonCode', label: 'Motivo de pérdida', type: 'select', placeholder: 'Elegí un motivo', options: lostReasonOptions },
            { name: 'lostReasonDetails', label: 'Más detalles', type: 'textarea', required: false, maxLength: 2000, placeholder: 'Opcional' },
          ]}
          values={lostReasonValues}
          error={lostReasonError}
          busy={saving}
          submitLabel="Cerrar como perdida"
          onValuesChange={values => setLostReasonValues({ lostReasonCode: values.lostReasonCode || '', lostReasonDetails: values.lostReasonDetails || '' })}
          onSubmit={submitLostLeadTransition}
          onOpenChange={handleLostReasonDialogOpenChange}
        />
        <LeadFormDialog
          mode="edit"
          open={editOpen}
          onOpenChange={setEditOpen}
          initialValues={leadFormValues(lead)}
          rooftops={[]}
          vehicles={[
            ...(lead.interestedVehicle && !vehicles.some(vehicle => vehicle.id === lead.interestedVehicle?.id)
              ? [{ ...lead.interestedVehicle, rooftop: { id: lead.rooftop.id } }]
              : []),
            ...vehicles.filter(vehicle => !vehicle.rooftop || vehicle.rooftop.id === lead.rooftop.id),
          ]}
          onSubmit={submitEdit}
        />
        <TransferLeadDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          staff={staff}
          currentOwnerId={lead.assignedSalesperson?.id || null}
          onSubmit={submitTransfer}
        />
        {visitDialog && (
          <SalesVisitDialog
            action={visitDialog.action}
            open={Boolean(visitDialog)}
            onOpenChange={open => { if (!open) setVisitDialog(null) }}
            timeZone={timeZone}
            staff={staff}
            vehicles={vehicles.filter(vehicle => !vehicle.rooftop || vehicle.rooftop.id === lead.rooftop.id)}
            defaultVehicleId={lead.interestedVehicle?.id || null}
            viewerId={viewer?.id || null}
            onSubmit={submitVisit}
          />
        )}
      </div>
    </PageContainer>
  )
}
