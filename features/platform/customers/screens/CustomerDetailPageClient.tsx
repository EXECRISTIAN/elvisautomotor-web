'use client'

import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GitMerge, Home, Mail, Pencil, Phone, RefreshCw, SlidersHorizontal, Unlink } from 'lucide-react'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, DeskSection, Facts, Notice, Panel, Pill, TitleLine, Track, type DeskTone } from '@/features/platform/components/desk'
import { OperatorActionDialog } from '@/features/platform/components/OperatorActionDialog'
import { formatPhone, recordReference } from '@/features/platform/lib/format'
import type { CrmViewer } from '@/features/platform/crm/actions'
import { CLOSED_LEAD_STATUSES, VISIT_STATUSES, formatDateTime, formatDay, leadStatus, personName, sourceLabel } from '@/features/platform/crm/lib/leadOptions'
import {
  getCustomer,
  getDuplicateCandidates,
  linkCustomerHousehold,
  mergeCustomers,
  unlinkCustomerHousehold,
  updateCustomerContact,
  updateCustomerPreferences,
  type CustomerDetail,
  type CustomerLead,
  type DuplicateCandidate,
} from '../actions'
import { CustomerContactDialog, type CustomerContactValues } from '../components/CustomerContactDialog'
import { ContactPreferencesDialog, PREFERENCE_SOURCES, type PreferenceValues } from '../components/ContactPreferencesDialog'
import { HouseholdLinkDialog } from '../components/HouseholdLinkDialog'
import { MergeCustomerDialog, type MergeParty } from '../components/MergeCustomerDialog'

type VehicleRef = { year: number | null; make: string | null; model: string | null } | null

const DEAL_TONE: Record<string, DeskTone> = { pencil: 'idle', submitted: 'warn', approved: 'info', financed: 'info', delivered: 'ok', cancelled: 'bad' }
const SERVICE_TONE: Record<string, DeskTone> = { scheduled: 'info', 'checked-in': 'warn', 'in-progress': 'warn', 'waiting-parts': 'warn', completed: 'ok', cancelled: 'idle' }
const RO_TONE: Record<string, DeskTone> = { estimate: 'idle', approved: 'info', 'in-progress': 'warn', completed: 'ok', invoiced: 'warn', paid: 'ok' }

function vehicleName(vehicle: VehicleRef) {
  if (!vehicle) return 'Sin vehículo'
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehículo'
}

function money(value: number | null | undefined) {
  if (value == null) return '-'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value)
}

const label = (value: string | null | undefined) => (value ? value.replaceAll('-', ' ') : '-')

function consentState(consent: boolean | null | undefined, suppressed: boolean | null | undefined): { text: string; tone: DeskTone } {
  if (suppressed) return { text: 'Bloqueado', tone: 'bad' }
  if (consent) return { text: 'Aceptó', tone: 'ok' }
  return { text: 'Sin consentimiento', tone: 'idle' }
}

function snapshotSummary(snapshot: any) {
  const value = snapshot?.mergedAfter || snapshot
  if (!value || typeof value !== 'object') return ''
  const channels = (['email', 'sms', 'phone'] as const).map(channel => {
    const state = value[`${channel}Suppressed`] ? 'bloqueado' : value[`${channel}Consent`] ? 'con consentimiento' : 'sin consentimiento'
    return `${channel === 'sms' ? 'SMS' : channel.charAt(0).toUpperCase() + channel.slice(1)} ${state}`
  })
  const preferred = value.preferredChannel && value.preferredChannel !== 'none' ? `prefiere ${value.preferredChannel === 'sms' ? 'SMS' : value.preferredChannel}` : 'no preferred channel'
  return [...channels, preferred].join(' · ')
}

function sourceName(value: string | null | undefined) {
  if (value === 'customer-merge') return 'Unificación de clientes'
  return PREFERENCE_SOURCES.find(source => source.value === value)?.label || label(value)
}

export function CustomerDetailPageClient({
  id,
  initialCustomer,
  initialDuplicates,
  initialDuplicateError,
  viewer,
  timeZone,
  initialError,
}: {
  id: string
  initialCustomer: CustomerDetail | null
  initialDuplicates: DuplicateCandidate[]
  initialDuplicateError: string | null
  viewer: CrmViewer | null
  timeZone: string
  initialError: string | null
}) {
  const router = useRouter()
  const [customer, setCustomer] = useState<CustomerDetail | null>(initialCustomer)
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>(initialDuplicates)
  const [duplicateError, setDuplicateError] = useState<string | null>(initialDuplicateError)
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ tone: DeskTone; text: string } | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [householdOpen, setHouseholdOpen] = useState(false)
  const [unlinkOpen, setUnlinkOpen] = useState(false)
  const [unlinkValues, setUnlinkValues] = useState<Record<string, string>>({ reason: '' })
  const [unlinkError, setUnlinkError] = useState<string | null>(null)
  const [unlinkBusy, setUnlinkBusy] = useState(false)
  const [mergeCandidate, setMergeCandidate] = useState<DuplicateCandidate | null>(null)
  const keys = useRef<Record<string, string>>({})

  const keyFor = (name: string, reset = false) => {
    if (reset || !keys.current[name]) keys.current[name] = `${name}:${id}:${crypto.randomUUID()}`
    return keys.current[name]
  }
  const clearKey = (name: string) => { delete keys.current[name] }

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true)
    setError(null)
    const response = await getCustomer(id)
    if (response.success && response.data.customer) {
      const loaded = response.data.customer
      setCustomer(loaded)
      if (loaded.status === 'active') {
        const found = await getDuplicateCandidates(loaded.id)
        setDuplicates(found.success ? found.data.customerDuplicateCandidates : [])
        setDuplicateError(found.success ? null : found.error)
      } else {
        setDuplicates([])
        setDuplicateError(null)
      }
    } else {
      setCustomer(null)
      setError(response.success ? 'No se encontró este cliente.' : response.error)
    }
    setLoading(false)
  }

  const breadcrumbs = [
    { type: 'link' as const, label: 'Inicio', href: basePath },
    { type: 'page' as const, label: 'Gestión' },
    { type: 'link' as const, label: 'Clientes', href: `${basePath}/platform/customers` },
    { type: 'page' as const, label: customer ? personName(customer.firstName, customer.lastName) : 'Cliente' },
  ]

  if (loading) {
    return (
      <PageContainer title="Clientes" breadcrumbs={breadcrumbs}>
        <div className="space-y-3 px-4 pb-24 md:px-6" role="status" aria-label="Cargando cliente">
          <div className="h-7 w-56 max-w-full animate-pulse rounded-[2px] bg-muted" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded-[2px] bg-muted" />
          <div className="h-48 animate-pulse rounded-md bg-muted" />
        </div>
      </PageContainer>
    )
  }

  if (!customer) {
    return (
      <PageContainer title="Clientes" breadcrumbs={breadcrumbs} header={<DeskHeader title="Cliente no disponible" tone="bad" status="No disponible" />}>
        <div className="space-y-3 px-4 pb-24 md:px-6">
          <Notice tone="bad">{error || 'No se encontró este cliente.'}</Notice>
          <Track>
            <Pill onClick={() => load()}>Reintentar</Pill>
            <Pill asChild><Link href={`${basePath}/platform/customers`}>Volver a clientes</Link></Pill>
          </Track>
        </div>
      </PageContainer>
    )
  }

  const name = personName(customer.firstName, customer.lastName)
  const merged = customer.status === 'merged'
  const canManage = viewer?.canManageLeads === true
  const disabledReason = merged ? 'Los clientes unificados son de solo lectura' : canManage ? undefined : 'Requiere permiso de gestión de consultas'
  const canAct = canManage && !merged
  const leads = customer.leads
  const openLeadCount = leads.filter(lead => !CLOSED_LEAD_STATUSES.includes(lead.status || '')).length
  const deals = leads.flatMap(lead => lead.deals.map(deal => ({ ...deal, lead })))
  const testDrives = leads.flatMap(lead => lead.testDrives.map(drive => ({ ...drive, lead })))
  const tradeIns = leads.flatMap(lead => lead.tradeIns.map(tradeIn => ({ ...tradeIn, lead })))
  const appointments = leads.flatMap(lead => lead.serviceAppointments.map(appointment => ({ ...appointment, lead })))
  const mergeEvents = [...customer.mergeEventsAsSurvivor, ...customer.mergeEventsAsDuplicate]
    .filter((event, index, all) => all.findIndex(other => other.id === event.id) === index)
    .sort((a, b) => Date.parse(b.mergedAt || '') - Date.parse(a.mergedAt || ''))
  const currentParty: MergeParty = {
    id: customer.id, firstName: customer.firstName, lastName: customer.lastName, primaryEmail: customer.primaryEmail,
    primaryPhone: customer.primaryPhone, leadsCount: leads.length, updatedAt: customer.updatedAt,
  }

  const submitContact = async (values: CustomerContactValues) => {
    const response = await updateCustomerContact({ customerId: customer.id, expectedUpdatedAt: customer.updatedAt, idempotencyKey: keyFor('customer-contact'), ...values })
    if (!response.success) return response.error
    clearKey('customer-contact')
    setContactOpen(false)
    setNotice({ tone: 'ok', text: 'Contacto guardado' })
    await load(true)
    return null
  }

  const submitPreferences = async (values: PreferenceValues) => {
    const response = await updateCustomerPreferences({ customerId: customer.id, expectedUpdatedAt: customer.updatedAt, idempotencyKey: keyFor('customer-preferences'), ...values })
    if (!response.success) return response.error
    clearKey('customer-preferences')
    setPreferencesOpen(false)
    setNotice({ tone: 'ok', text: 'Preferencias guardadas' })
    await load(true)
    return null
  }

  const submitHousehold = async ({ member, displayName }: { member: { id: string; updatedAt: string }; displayName: string }) => {
    const response = await linkCustomerHousehold({
      primaryCustomerId: customer.id,
      memberCustomerId: member.id,
      primaryExpectedUpdatedAt: customer.updatedAt,
      memberExpectedUpdatedAt: member.updatedAt,
      displayName,
      idempotencyKey: keyFor('customer-household'),
    })
    if (!response.success) return response.error
    clearKey('customer-household')
    setHouseholdOpen(false)
    setNotice({ tone: 'ok', text: 'Grupo familiar vinculado' })
    await load(true)
    return null
  }

  const submitUnlink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!unlinkValues.reason?.trim()) { setUnlinkError('El motivo es obligatorio'); return }
    setUnlinkBusy(true)
    setUnlinkError(null)
    const response = await unlinkCustomerHousehold({ customerId: customer.id, expectedUpdatedAt: customer.updatedAt, reason: unlinkValues.reason.trim(), idempotencyKey: keyFor('customer-household-unlink') })
    setUnlinkBusy(false)
    if (!response.success) { setUnlinkError(response.error); return }
    clearKey('customer-household-unlink')
    setUnlinkOpen(false)
    setNotice({ tone: 'ok', text: 'Quitado del grupo familiar' })
    await load(true)
  }

  const submitMerge = async ({ survivor, duplicate, reason }: { survivor: MergeParty; duplicate: MergeParty; reason: string }) => {
    const response = await mergeCustomers({
      survivorId: survivor.id,
      duplicateId: duplicate.id,
      survivorExpectedUpdatedAt: survivor.updatedAt,
      duplicateExpectedUpdatedAt: duplicate.updatedAt,
      reason,
      idempotencyKey: keyFor(`customer-merge-${duplicate.id}`),
    })
    if (!response.success) return response.error
    clearKey(`customer-merge-${duplicate.id}`)
    setMergeCandidate(null)
    const result = response.data.mergeCustomers
    setNotice({ tone: 'ok', text: `Merged · ${result.movedLeadCount} lead${result.movedLeadCount === 1 ? '' : 's'} and ${result.movedSalesVisitCount} visit${result.movedSalesVisitCount === 1 ? '' : 's'} moved` })
    if (survivor.id !== customer.id) router.push(`${basePath}/platform/customers/${survivor.id}`)
    else await load(true)
    return null
  }

  const header = (
    <DeskHeader
      title={name}
      tone={merged ? 'idle' : 'ok'}
      status={merged ? 'Unificado' : 'Activo'}
      meta={<span>{merged ? 'Unificado' : 'Activo'} · {openLeadCount} consulta{openLeadCount === 1 ? '' : 's'} abierta{openLeadCount === 1 ? '' : 's'}{customer.rooftop?.name ? ` · ${customer.rooftop.name}` : ''} · Cliente desde {formatDay(customer.createdAt, timeZone)} · <Code>{recordReference('CUS', customer.id)}</Code></span>}
      actions={
        <>
          <Pill variant="plain" className="max-md:h-10" onClick={() => load()} aria-label="Actualizar"><RefreshCw /></Pill>
          <Pill variant={!customer.primaryPhone && !customer.primaryEmail ? 'primary' : 'raised'} className="max-md:h-10" onClick={() => { keyFor('customer-contact', true); setContactOpen(true) }} disabled={!canAct} title={disabledReason}><Pencil />Editar contacto</Pill>
          {customer.primaryEmail && <Pill asChild className="max-md:h-10" variant={customer.primaryPhone ? 'raised' : 'primary'}><a href={`mailto:${customer.primaryEmail}`}><Mail />Email</a></Pill>}
          {customer.primaryPhone && <Pill asChild className="max-md:h-10" variant="primary"><a href={`tel:${customer.primaryPhone}`}><Phone />Llamar</a></Pill>}
        </>
      }
    />
  )

  const empty = (text: string) => <p className="text-sm text-muted-foreground">{text}</p>
  const leadLink = (lead: Pick<CustomerLead, 'id' | 'firstName' | 'lastName'>, children: ReactNode) => (
    <Link href={`${basePath}/platform/crm/${lead.id}`} className="underline underline-offset-2">{children}</Link>
  )

  return (
    <PageContainer title="Clientes" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full px-4 pb-24 md:px-6">
        {merged && (
          <Notice tone="warn" className="mb-4">
            Merged {formatDateTime(customer.mergedAt, timeZone)}
            {customer.mergedInto && <> into <Link className="font-medium underline underline-offset-2" href={`${basePath}/platform/customers/${customer.mergedInto.id}`}>{personName(customer.mergedInto.firstName, customer.mergedInto.lastName)}</Link></>}
          </Notice>
        )}
        {notice && <Notice tone={notice.tone} className="mb-4">{notice.text}</Notice>}
        {!canManage && <p className="mb-4 text-xs text-muted-foreground">Solo lectura · requiere permiso de gestión de consultas</p>}

        <DeskSection title="Contacto" id="customer-contact" className="mb-8">
          <div className="grid min-w-0 grid-cols-1 gap-x-8 md:grid-cols-2">
            <Facts items={[
              { label: 'Teléfono', value: customer.primaryPhone ? <a className="underline-offset-2 hover:underline" href={`tel:${customer.primaryPhone}`}>{formatPhone(customer.primaryPhone)}</a> : '-' },
              { label: 'Email', value: customer.primaryEmail ? <a className="break-all underline-offset-2 hover:underline" href={`mailto:${customer.primaryEmail}`}>{customer.primaryEmail}</a> : '-' },
              { label: 'Preferido', value: <span className="capitalize">{customer.preferredChannel && customer.preferredChannel !== 'none' ? (customer.preferredChannel === 'sms' ? 'SMS' : customer.preferredChannel) : 'Ninguno'}</span> },
            ]} />
            <Facts items={[
              { label: 'Nombre', value: name },
              { label: 'Grupo familiar', value: customer.household?.displayName || 'Ninguno' },
              { label: 'Actualizado', value: formatDateTime(customer.updatedAt, timeZone) },
            ]} />
          </div>
        </DeskSection>

        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-8">
            <DeskSection title="Consultas" count={leads.length}>
              {leads.length === 0 ? empty('No hay consultas') : (
                <Panel className="divide-y">
                  {leads.map(lead => {
                    const status = leadStatus(lead.status)
                    return (
                      <Link key={lead.id} href={`${basePath}/platform/crm/${lead.id}`} className="flex min-h-11 min-w-0 flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                        <div className="min-w-0">
                          <TitleLine as="p" tone={status.tone} status={status.label} className="text-sm font-medium">
                            {lead.interestedVehicle ? vehicleName(lead.interestedVehicle) : personName(lead.firstName, lead.lastName, 'Consulta')}
                          </TitleLine>
                          <p className="pl-4 text-xs text-muted-foreground">{[status.label, sourceLabel(lead.source), `Created ${formatDay(lead.createdAt, timeZone)}`].join(' · ')}</p>
                        </div>
                        <div className="pl-4 text-xs sm:shrink-0 sm:pl-0 sm:text-right">
                          <p className={lead.assignedSalesperson ? 'font-medium' : 'text-muted-foreground'}>{lead.assignedSalesperson?.name || 'Sin asignar'}</p>
                          <p className="text-muted-foreground">{lead.lastContact ? `Contacted ${formatDay(lead.lastContact, timeZone)}` : 'Sin contactar'}</p>
                        </div>
                      </Link>
                    )
                  })}
                </Panel>
              )}
            </DeskSection>

            <DeskSection title="Operaciones" count={deals.length}>
              {deals.length === 0 ? empty('Sin operaciones') : (
                <Panel className="divide-y">
                  {deals.map(deal => (
                    <Link key={deal.id} href={`${basePath}/platform/deals/${deal.id}`} className="flex min-h-11 min-w-0 items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                      <div className="min-w-0">
                        <TitleLine as="p" tone={DEAL_TONE[deal.status || ''] ?? 'idle'} status={deal.status || undefined} className="text-sm font-medium">{vehicleName(deal.vehicle)}</TitleLine>
                        <p className="pl-4 text-xs capitalize text-muted-foreground">{label(deal.status)} · {deal.saleDate ? `Sold ${formatDay(deal.saleDate, timeZone)}` : `Opened ${formatDay(deal.createdAt, timeZone)}`}</p>
                      </div>
                      <p className="shrink-0 text-sm font-medium tabular-nums">{money(deal.vehiclePrice)}</p>
                    </Link>
                  ))}
                </Panel>
              )}
            </DeskSection>

            <DeskSection title="Pruebas de manejo" count={testDrives.length}>
              {testDrives.length === 0 ? empty('Sin pruebas de manejo') : (
                <Panel className="divide-y">
                  {testDrives.map(drive => {
                    const state = drive.completed ? 'Completada' : drive.noShow ? 'Ausente' : 'Agendada'
                    return (
                      <div key={drive.id} className="flex min-w-0 items-baseline justify-between gap-3 px-4 py-2.5">
                        <TitleLine as="p" tone={drive.completed ? 'ok' : drive.noShow ? 'bad' : 'info'} status={state} className="text-sm">{vehicleName(drive.vehicle)}</TitleLine>
                        <span className="shrink-0 text-right text-xs text-muted-foreground"><span className="tabular-nums">{formatDateTime(drive.scheduledTime, timeZone)}</span> · {state}</span>
                      </div>
                    )
                  })}
                </Panel>
              )}
            </DeskSection>

            <DeskSection title="Usados ofrecidos" count={tradeIns.length}>
              {tradeIns.length === 0 ? empty('No hay usados ofrecidos') : (
                <Panel className="divide-y">
                  {tradeIns.map(tradeIn => (
                    <div key={tradeIn.id} className="flex min-w-0 items-start justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <TitleLine as="p" tone={tradeIn.offerAmount != null ? 'ok' : 'warn'} status={tradeIn.offerAmount != null ? 'Tasado' : 'Esperando tasación'} className="text-sm font-medium">{vehicleName(tradeIn)}</TitleLine>
                        <p className="pl-4 text-xs text-muted-foreground">{[tradeIn.mileage != null ? `${tradeIn.mileage.toLocaleString('es-AR')} km` : null, `Recibido ${formatDay(tradeIn.createdAt, timeZone)}`, tradeIn.offerAmount != null ? 'Tasado' : 'Esperando tasación'].filter(Boolean).join(' · ')}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium tabular-nums">{money(tradeIn.offerAmount)}</p>
                        <Link href={`${basePath}/platform/trade-ins`} className="text-xs underline underline-offset-2">Usados ofrecidos</Link>
                      </div>
                    </div>
                  ))}
                </Panel>
              )}
            </DeskSection>

            <DeskSection title="Taller" count={appointments.length}>
              {appointments.length === 0 ? empty('No service appointments') : (
                <Panel className="divide-y">
                  {appointments.map(appointment => (
                    <div key={appointment.id} className="space-y-1 px-4 py-2.5">
                      <div className="flex min-w-0 items-baseline justify-between gap-3">
                        <TitleLine as="p" tone={SERVICE_TONE[appointment.status || ''] ?? 'idle'} status={appointment.status || undefined} className="text-sm font-medium capitalize">
                          {label(appointment.serviceType)} · {appointment.customerVehicleDescription || 'Vehículo'}
                        </TitleLine>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDateTime(appointment.appointmentDate, timeZone)}</span>
                      </div>
                      <p className="pl-4 text-xs capitalize text-muted-foreground">{label(appointment.status)}</p>
                      {appointment.serviceOrder && (
                        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 pl-4 text-xs">
                          <TitleLine as="span" tone={RO_TONE[appointment.serviceOrder.status || ''] ?? 'idle'} status={appointment.serviceOrder.status || undefined}>
                            <Code>{appointment.serviceOrder.invoiceNumber || recordReference('RO', appointment.serviceOrder.id)}</Code>
                          </TitleLine>
                          <span className="capitalize text-muted-foreground">{label(appointment.serviceOrder.status)}</span>
                          <span className="tabular-nums">{money(appointment.serviceOrder.grandTotal)}</span>
                          <Link href={`${basePath}/platform/service`} className="underline underline-offset-2">Taller</Link>
                        </p>
                      )}
                    </div>
                  ))}
                </Panel>
              )}
            </DeskSection>

            <DeskSection title="Visitas" count={customer.salesVisits.length}>
              {customer.salesVisits.length === 0 ? empty('Sin visitas') : (
                <Panel className="divide-y">
                  {customer.salesVisits.map(visit => {
                    const status = VISIT_STATUSES[visit.status || ''] || { label: label(visit.status), tone: 'idle' as DeskTone }
                    return (
                      <div key={visit.id} className="flex min-w-0 items-start justify-between gap-3 px-4 py-2.5">
                        <div className="min-w-0">
                          <TitleLine as="p" tone={status.tone} status={status.label} className="text-sm font-medium">{visit.kind === 'showroom' ? 'Visita al salón' : 'Cita de venta'} · {status.label}</TitleLine>
                          <p className="pl-4 text-xs text-muted-foreground">{[visit.vehicle ? vehicleName(visit.vehicle) : null, visit.outcome ? `Outcome: ${label(visit.outcome)}` : null].filter(Boolean).join(' · ') || '-'}</p>
                        </div>
                        <div className="shrink-0 text-right text-xs">
                          <p className="tabular-nums text-muted-foreground">{formatDateTime(visit.completedAt || visit.scheduledAt, timeZone)}</p>
                          {visit.lead && leadLink({ id: visit.lead.id, firstName: null, lastName: null }, 'Consulta')}
                        </div>
                      </div>
                    )
                  })}
                </Panel>
              )}
            </DeskSection>
          </div>

          <div className="min-w-0 space-y-8">
            <DeskSection
              title="Grupo familiar"
              actions={
                <Track>
                  {customer.household && (
                    <Pill size="sm" className="h-11 sm:h-7" onClick={() => { keyFor('customer-household-unlink', true); setUnlinkValues({ reason: '' }); setUnlinkError(null); setUnlinkOpen(true) }} disabled={!canAct} title={disabledReason}>
                      <Unlink />Desvincular
                    </Pill>
                  )}
                  <Pill size="sm" className="h-11 sm:h-7" onClick={() => { keyFor('customer-household', true); setHouseholdOpen(true) }} disabled={!canAct} title={disabledReason}>
                    <Home />{customer.household ? 'Agregar integrante' : 'Vincular'}
                  </Pill>
                </Track>
              }
            >
              {customer.household ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{customer.household.displayName}</p>
                  <Panel className="divide-y">
                    {customer.household.members.map(member => (
                      <div key={member.id} className="flex min-h-11 min-w-0 items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <TitleLine as="p" tone={member.status === 'merged' ? 'idle' : 'ok'} status={member.status || undefined} className="text-sm">
                            {member.id === customer.id ? `${personName(member.firstName, member.lastName)} (this customer)` : (
                              <Link href={`${basePath}/platform/customers/${member.id}`} className="underline underline-offset-2">{personName(member.firstName, member.lastName)}</Link>
                            )}
                          </TitleLine>
                          <p className="truncate pl-4 text-xs text-muted-foreground">{[member.primaryEmail, formatPhone(member.primaryPhone), member.status === 'merged' ? 'Unificado' : null].filter(Boolean).join(' · ') || '-'}</p>
                        </div>
                      </div>
                    ))}
                  </Panel>
                </div>
              ) : empty('No household')}
            </DeskSection>

            <DeskSection title="Posibles duplicados" count={merged ? undefined : duplicates.length} id="duplicates">
              {merged ? empty('No se verifica en clientes unificados') : duplicateError ? (
                <Notice tone="bad">{duplicateError}</Notice>
              ) : duplicates.length === 0 ? empty('No duplicates') : (
                <Panel className="divide-y">
                  {duplicates.map(candidate => (
                    <div key={candidate.id} className="flex min-w-0 items-start justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <TitleLine as="p" tone="warn" status="Possible duplicate" className="text-sm font-medium">
                          <Link href={`${basePath}/platform/customers/${candidate.id}`} className="underline underline-offset-2">{personName(candidate.firstName, candidate.lastName)}</Link>
                        </TitleLine>
                        <p className="truncate pl-4 text-xs text-muted-foreground">{[candidate.primaryEmail, formatPhone(candidate.primaryPhone)].filter(Boolean).join(' · ')}</p>
                        <p className="pl-4 text-xs text-muted-foreground">{candidate.leadsCount} lead{candidate.leadsCount === 1 ? '' : 's'} · since {formatDay(candidate.createdAt, timeZone)}</p>
                      </div>
                      <Track className="shrink-0">
                        <Pill size="sm" className="h-11 sm:h-7" onClick={() => setMergeCandidate(candidate)} disabled={!canAct} title={disabledReason}><GitMerge />Unificar</Pill>
                      </Track>
                    </div>
                  ))}
                </Panel>
              )}
            </DeskSection>

            <DeskSection
              title="Preferencias de contacto"
              actions={
                <Track>
                  <Pill size="sm" className="h-11 sm:h-7" onClick={() => { keyFor('customer-preferences', true); setPreferencesOpen(true) }} disabled={!canAct} title={disabledReason}>
                    <SlidersHorizontal />Editar
                  </Pill>
                </Track>
              }
            >
              <Facts items={(['email', 'sms', 'phone'] as const).map(channel => {
                const state = consentState(customer[`${channel}Consent`], customer[`${channel}Suppressed`])
                return { label: channel === 'sms' ? 'SMS' : channel.charAt(0).toUpperCase() + channel.slice(1), value: <TitleLine as="span" tone={state.tone} className="justify-end">{state.text}</TitleLine> }
              }).concat([
                { label: 'Preferido', value: <span className="capitalize">{customer.preferredChannel && customer.preferredChannel !== 'none' ? (customer.preferredChannel === 'sms' ? 'SMS' : customer.preferredChannel) : 'Ninguno'}</span> },
                ...(customer.suppressionReason ? [{ label: 'Bloqueo', value: <span>{customer.suppressionReason}</span> }] : []),
              ])} />
              <p className="mt-4 text-[12px] font-medium text-muted-foreground">Historial</p>
              {customer.contactPreferenceEvents.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">Sin cambios</p> : (
                <ol className="mt-2 space-y-0">
                  {customer.contactPreferenceEvents.map(event => (
                    <li key={event.id} className="relative border-l pb-3 pl-4 last:pb-0">
                      <span className="absolute -left-[4px] top-1.5 size-2 rounded-[1px] bg-muted-foreground/50" aria-hidden="true" />
                      <p className="text-sm">{sourceName(event.source)}</p>
                      <p className="text-xs text-muted-foreground">{[formatDateTime(event.occurredAt, timeZone), event.actor?.name].filter(Boolean).join(' · ')}</p>
                      {event.reason && <p className="break-words text-xs">{event.reason}</p>}
                      <p className="break-words text-xs text-muted-foreground">{snapshotSummary(event.preferenceSnapshot)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </DeskSection>

            <DeskSection title="Historial de unificaciones" count={mergeEvents.length}>
              {mergeEvents.length === 0 ? empty('No merges') : (
                <ol className="space-y-0">
                  {mergeEvents.map(event => {
                    const asSurvivor = event.survivor?.id === customer.id
                    const other = asSurvivor ? event.duplicate : event.survivor
                    return (
                      <li key={event.id} className="relative border-l pb-3 pl-4 last:pb-0">
                        <span className="absolute -left-[4px] top-1.5 size-2 rounded-[1px] bg-muted-foreground/50" aria-hidden="true" />
                        <p className="text-sm">
                          {asSurvivor ? 'Absorbed ' : 'Merged into '}
                          {other ? <Link href={`${basePath}/platform/customers/${other.id}`} className="underline underline-offset-2">{personName(other.firstName, other.lastName)}</Link> : 'customer'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[formatDateTime(event.mergedAt, timeZone), event.actor?.name ? `por ${event.actor.name}` : null, `${(event.movedLeadIds || []).length} lead${(event.movedLeadIds || []).length === 1 ? '' : 's'} moved`].filter(Boolean).join(' · ')}
                        </p>
                        {event.reason && <p className="break-words text-xs">{event.reason}</p>}
                      </li>
                    )
                  })}
                </ol>
              )}
              {customer.mergedCustomers.length > 0 && mergeEvents.length === 0 && (
                <p className="text-xs text-muted-foreground">{customer.mergedCustomers.length} merged record{customer.mergedCustomers.length === 1 ? '' : 's'}</p>
              )}
            </DeskSection>
          </div>
        </div>
      </div>

      <CustomerContactDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        initialValues={{ firstName: customer.firstName || '', lastName: customer.lastName || '', primaryEmail: customer.primaryEmail || '', primaryPhone: customer.primaryPhone || '' }}
        onSubmit={submitContact}
      />
      <ContactPreferencesDialog
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
        initialValues={{
          emailConsent: customer.emailConsent === true,
          smsConsent: customer.smsConsent === true,
          phoneConsent: customer.phoneConsent === true,
          emailSuppressed: customer.emailSuppressed === true,
          smsSuppressed: customer.smsSuppressed === true,
          phoneSuppressed: customer.phoneSuppressed === true,
          preferredChannel: customer.preferredChannel || 'none',
          source: 'operator-recorded',
          reason: '',
        }}
        onSubmit={submitPreferences}
      />
      {customer.rooftop && (
        <HouseholdLinkDialog
          open={householdOpen}
          onOpenChange={setHouseholdOpen}
          customerId={customer.id}
          rooftopId={customer.rooftop.id}
          currentHousehold={customer.household}
          defaultDisplayName={`${customer.lastName || name} household`}
          onSubmit={submitHousehold}
        />
      )}
      <OperatorActionDialog
        open={unlinkOpen}
        title="Quitar del grupo familiar"
        fields={[{ name: 'reason', label: 'Motivo', type: 'textarea', maxLength: 1000 }]}
        values={unlinkValues}
        error={unlinkError}
        busy={unlinkBusy}
        submitLabel="Desvincular"
        onValuesChange={setUnlinkValues}
        onSubmit={submitUnlink}
        onOpenChange={setUnlinkOpen}
      />
      <MergeCustomerDialog
        open={Boolean(mergeCandidate)}
        onOpenChange={open => { if (!open) setMergeCandidate(null) }}
        current={currentParty}
        candidate={mergeCandidate ? { ...mergeCandidate, leadsCount: mergeCandidate.leadsCount } : null}
        onSubmit={submitMerge}
      />
    </PageContainer>
  )
}
