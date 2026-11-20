'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, DeskSection, DeskTable, Facts, Figure, Notice, Pill, Readout, ReadoutStrip, Status, Td, Th, TitleLine, Tr, Track } from '@/features/platform/components/desk'
import { formatPhone } from '@/features/platform/lib/format'
import { decisionNeedsLenderReference, type FinancingDecision } from '@/features/keystone/lifecycle/financingLifecycle'
import { parseDollarsToCents, parsePercentToBps } from '@/features/platform/deals/lib/moneyInput'
import { getFinancingApplication, openApplicationFollowUp, queueApplicationToLender, recordApplicationDecision, recordSubmissionStatus } from '../actions/applications'
import { FinanceFormDialog, type FieldErrors, type FinanceFormField } from '../components/FinanceFormDialog'
import type { ApplicationDetail, ApplicationSubmission } from '../lib/applicationTypes'
import { creditTierLabel, employmentLabel, formatApr, formatCents, formatDateTime, formatDay, newIdempotencyKey, personName, stateTone, vehicleName } from '../lib/display'

type DialogState =
  | { kind: 'queue'; values: Record<string, string>; idempotencyKey: string }
  | { kind: 'sent' | 'failed'; submission: ApplicationSubmission; values: Record<string, string>; idempotencyKey: string }
  | { kind: 'decision'; values: Record<string, string>; idempotencyKey: string }
  | { kind: 'follow-up'; values: Record<string, string>; idempotencyKey: string }

const statusLabels: Record<string, string> = {
  submitted: 'Enviada',
  'under-review': 'En revisión',
  approved: 'Aprobada',
  declined: 'Rechazada',
  expired: 'Vencida',
  cancelled: 'Cancelada',
}

const decisionLabels: Record<string, string> = { approved: 'Aprobada', conditional: 'Condicional', declined: 'Rechazada', expired: 'Vencida', cancelled: 'Cancelada' }

/** Decisions the server accepts from each application status (financingLifecycle). */
const decisionsByStatus: Record<string, string[]> = {
  submitted: ['cancelled'],
  'under-review': ['approved', 'conditional', 'declined', 'expired', 'cancelled'],
  approved: ['expired', 'cancelled'],
}

const providerLabels: Record<string, string> = { 'operator-recorded': 'Entidad cargada manualmente' }

function label(value: string) {
  const words = value.replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function FinancingApplicationPageClient({
  id,
  initial,
  initialError,
  timeZone,
}: {
  id: string
  initial: ApplicationDetail | null
  initialError: string | null
  timeZone: string
}) {
  const router = useRouter()
  const [application, setApplication] = useState<ApplicationDetail | null>(initial)
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = async () => {
    setLoading(true)
    const response = await getFinancingApplication(id)
    if (response.success && response.data.financingApplication) { setApplication(response.data.financingApplication); setError(null) }
    else setError(response.success ? 'No se encontró la solicitud o no tienes acceso.' : response.error)
    setLoading(false)
    router.refresh()
  }

  const breadcrumbs = [
    { type: 'link' as const, label: 'Inicio', href: basePath },
    { type: 'page' as const, label: 'Gestión' },
    { type: 'link' as const, label: 'Solicitudes de crédito', href: `${basePath}/platform/finance` },
    { type: 'page' as const, label: application?.reference || 'Application' },
  ]

  if (!application) {
    return (
      <PageContainer title="Solicitud de financiación" breadcrumbs={breadcrumbs} header={<DeskHeader title="Solicitud de financiación" tone="bad" status="No disponible" />}>
        <div className="space-y-3 px-4 pb-24 md:px-6">
          <Notice tone="bad"><p className="font-medium">La solicitud no está disponible</p><p className="mt-0.5 text-muted-foreground">{error}</p></Notice>
          <Track>
            <Pill onClick={reload} disabled={loading}>Reintentar</Pill>
            <Pill asChild variant="plain"><Link href={`${basePath}/platform/finance`}>Financiación</Link></Pill>
          </Track>
        </div>
      </PageContainer>
    )
  }

  const app = application
  const applicant = app.applicantName || personName(app.lead, 'Finance applicant')
  const allowedDecisions = decisionsByStatus[app.status] || []
  const canQueue = ['submitted', 'under-review'].includes(app.status)
  const openTask = app.lead?.tasks.find(task => !task.completed) || null
  const queueReason = canQueue ? null : `Application is ${statusLabels[app.status]?.toLowerCase() || app.status}`
  const decisionReason = allowedDecisions.length ? null : `Application is ${statusLabels[app.status]?.toLowerCase() || app.status}`
  const followUpReason = !app.lead ? 'Esta solicitud no tiene consulta vinculada' : openTask ? `Open task: ${openTask.title || 'follow-up'}` : null
  const latestApproval = app.decisions.find(decision => ['approved', 'conditional'].includes(decision.decision)) || null

  const start = (next: DialogState) => { setFieldErrors({}); setFormError(null); setNotice(null); setDialog(next) }

  const submit = async () => {
    if (!dialog) return
    const v = dialog.values
    const errors: FieldErrors = {}
    let run: (() => Promise<{ success: boolean; error?: string }>) | null = null
    let message = 'Guardado.'
    if (dialog.kind === 'queue') {
      if (!providerLabels[v.providerKey]) errors.providerKey = 'Elige un canal de la entidad.'
      run = () => queueApplicationToLender({ applicationId: app.id, providerKey: v.providerKey, idempotencyKey: dialog.idempotencyKey })
      message = 'Enviada a la entidad.'
    } else if (dialog.kind === 'sent') {
      const reference = (v.reference || '').trim()
      if (!reference) errors.reference = 'Ingresa la referencia de la entidad o del portal.'
      else if (reference.length > 200) errors.reference = 'Usa 200 caracteres o menos.'
      run = () => recordSubmissionStatus(app.id, { submissionId: dialog.submission.id, status: 'submitted', externalReference: reference, idempotencyKey: dialog.idempotencyKey })
      message = 'Envío registrado.'
    } else if (dialog.kind === 'failed') {
      const reason = (v.reason || '').trim()
      if (!reason) errors.reason = 'Indica por qué no se pudo enviar.'
      else if (reason.length > 200) errors.reason = 'Usa 200 caracteres o menos.'
      run = () => recordSubmissionStatus(app.id, { submissionId: dialog.submission.id, status: 'failed', errorCode: reason, idempotencyKey: dialog.idempotencyKey })
      message = 'Envío registrado como fallido.'
    } else if (dialog.kind === 'follow-up') {
      const reason = (v.reason || '').trim()
      if (!reason) errors.reason = 'Indica qué hay que seguir.'
      if (app.lead) run = () => openApplicationFollowUp(app.id, { leadId: app.lead!.id, reason, idempotencyKey: dialog.idempotencyKey })
      message = 'Tarea de seguimiento creada.'
    } else {
      const decision = v.decision
      if (!allowedDecisions.includes(decision)) errors.decision = 'Elige una decisión.'
      const reference = (v.reference || '').trim()
      const submission = app.submissions.find(item => item.id === v.submissionId)
      if (!reference && decisionNeedsLenderReference(decision as FinancingDecision, submission?.id)) errors.reference = 'Ingresa la referencia de la decisión de la entidad.'
      const reasonCodes = (v.reasonCodes || '').split(',').map(code => code.trim()).filter(Boolean)
      if (decision === 'declined' && !reasonCodes.length) errors.reasonCodes = 'Ingresa al menos un código de motivo.'
      const hasTerms = ['approved', 'conditional'].includes(decision)
      let approvedAmountCents: number | null = null
      let aprBasisPoints: number | null = null
      let termMonths: number | null = null
      let monthlyPaymentCents: number | null = null
      if (hasTerms) {
        approvedAmountCents = (v.amount || '').trim() ? parseDollarsToCents(v.amount) : null
        if (!approvedAmountCents) errors.amount = 'Ingresa el monto aprobado.'
        aprBasisPoints = (v.apr || '').trim() ? parsePercentToBps(v.apr) : null
        if (aprBasisPoints == null) errors.apr = 'Enter the APR, for example 6.49.'
        termMonths = Number(v.term)
        if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 120) errors.term = 'Enter 1 to 120 months.'
        monthlyPaymentCents = (v.payment || '').trim() ? parseDollarsToCents(v.payment) : null
        if ((v.payment || '').trim() && monthlyPaymentCents == null) errors.payment = 'Ingresa un importe.'
      }
      if (app.submissions.length && !submission && decision !== 'cancelled') errors.submissionId = 'Elige el envío al que responde esta decisión.'
      run = () => recordApplicationDecision({
        applicationId: app.id,
        submissionId: submission?.id,
        providerKey: submission?.providerKey || 'operator-recorded',
        idempotencyKey: dialog.idempotencyKey,
        externalReference: reference,
        decision,
        approvedAmountCents,
        aprBasisPoints,
        termMonths: hasTerms ? termMonths : null,
        monthlyPaymentCents,
        reasonCodes,
      })
      message = `Decision recorded: ${decisionLabels[decision] || decision}.`
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length || !run) return
    setBusy(true); setFormError(null)
    const response = await run()
    setBusy(false)
    if (!response.success) { setFormError(response.error || 'No se pudo guardar.'); return }
    setDialog(null)
    setNotice(message)
    await reload()
  }

  const decisionValue = dialog?.kind === 'decision' ? dialog.values.decision : ''
  const fields: FinanceFormField[] = !dialog ? [] : dialog.kind === 'queue' ? [
    { name: 'providerKey', label: 'Canal de la entidad', type: 'select', options: Object.entries(providerLabels).map(([value, label]) => ({ value, label })), wide: true },
  ] : dialog.kind === 'sent' ? [
    { name: 'reference', label: 'Referencia de la entidad', placeholder: 'Número de solicitud en la entidad', maxLength: 200, wide: true },
  ] : dialog.kind === 'failed' ? [
    { name: 'reason', label: 'Motivo del fallo', maxLength: 200, wide: true },
  ] : dialog.kind === 'follow-up' ? [
    { name: 'reason', label: 'Seguimiento', type: 'textarea', maxLength: 500 },
  ] : [
    ...(app.submissions.length ? [{ name: 'submissionId', label: 'Envío', type: 'select' as const, wide: true, options: app.submissions.map(item => ({ value: item.id, label: `${providerLabels[item.providerKey] || item.providerKey} · ${item.status}${item.externalReference ? ` · ${item.externalReference}` : ''} · ${formatDay(item.queuedAt, timeZone)}` })) }] : []),
    { name: 'decision', label: 'Decisión', type: 'select', options: allowedDecisions.map(value => ({ value, label: decisionLabels[value] })) },
    ...(decisionValue === 'cancelled' && !app.submissions.length
      ? [{ name: 'reference', label: 'Nota', maxLength: 200, placeholder: 'Opcional', description: 'No se envió a una entidad, así que no hace falta referencia.' }]
      : [{ name: 'reference', label: 'Referencia de la decisión', maxLength: 200 }]),
    ...(decisionValue === 'declined' ? [{ name: 'reasonCodes', label: 'Motivos', placeholder: 'DTI, THIN-FILE', wide: true, description: 'Separados por coma' }] : []),
    ...(['approved', 'conditional'].includes(decisionValue) ? [
      { name: 'amount', label: 'Monto aprobado', type: 'money' as const },
      { name: 'apr', label: 'Tasa (TNA %)', placeholder: '6.49' },
      { name: 'term', label: 'Plazo (meses)', type: 'number' as const, placeholder: '72' },
      { name: 'payment', label: 'Cuota (opcional)', type: 'money' as const },
    ] : []),
  ]
  const dialogTitles: Record<DialogState['kind'], string> = {
    queue: 'Enviar a una entidad', sent: 'Registrar envío a la entidad', failed: 'Registrar envío fallido', decision: 'Registrar decisión de la entidad', 'follow-up': 'Crear tarea de seguimiento',
  }

  const reasons = [queueReason ? `Queue: ${queueReason}` : null, decisionReason ? `Decision: ${decisionReason}` : null, followUpReason ? `Follow-up: ${followUpReason}` : null].filter(Boolean)
  const queuePrimary = canQueue && !app.submissions.length
  const decisionPrimary = !queuePrimary && app.status === 'under-review'

  const header = (
    <DeskHeader
      title={applicant}
      tone={stateTone(app.status)}
      status={statusLabels[app.status] || app.status}
      meta={
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <Status tone={stateTone(app.status)}>{statusLabels[app.status] || app.status}</Status>
          <Code>{app.reference}</Code>
          <span>{vehicleName(app.vehicle, 'Sin vehículo elegido')}</span>
          <span>Submitted {formatDay(app.submittedAt, timeZone)}</span>
          {app.rooftop && <span>{app.rooftop.name}</span>}
        </span>
      }
      actions={
        <>
          <Pill asChild variant="plain"><Link href={`${basePath}/platform/finance`}><ArrowLeft />Financiación</Link></Pill>
          <Pill variant="plain" onClick={reload} disabled={loading} aria-label="Actualizar"><RefreshCw className={loading ? 'animate-spin' : undefined} />Actualizar</Pill>
        </>
      }
    />
  )

  return (
    <PageContainer title={`Application ${app.reference}`} header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-8 px-4 pb-24 md:px-6">
        {notice && (
          <Notice tone="ok">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0">{notice}</p>
              <Track><Pill size="sm" variant="plain" onClick={() => setNotice(null)}>Descartar</Pill></Track>
            </div>
          </Notice>
        )}
        {error && <Notice tone="bad">{error}</Notice>}

        <div className="space-y-2">
          <Track aria-label="Acciones de la solicitud" className="flex-wrap">
            <Pill variant={queuePrimary ? 'primary' : 'raised'} disabled={!canQueue || busy} onClick={() => start({ kind: 'queue', values: { providerKey: 'operator-recorded' }, idempotencyKey: newIdempotencyKey(`lender-queue:${app.id}`) })}>
              {app.submissions.length ? 'Enviar a otra entidad' : 'Enviar a una entidad'}
            </Pill>
            <Pill variant={decisionPrimary ? 'primary' : 'raised'} disabled={!allowedDecisions.length || busy} onClick={() => start({ kind: 'decision', values: { submissionId: app.submissions[0]?.id || '', decision: '', reference: '', reasonCodes: '', amount: '', apr: '', term: '', payment: '' }, idempotencyKey: newIdempotencyKey(`lender-decision:${app.id}`) })}>
              Registrar decisión
            </Pill>
            <Pill disabled={Boolean(followUpReason) || busy} onClick={() => start({ kind: 'follow-up', values: { reason: 'Revisa la solicitud de financiación y decidí el próximo paso.' }, idempotencyKey: newIdempotencyKey(`finance-follow-up:${app.lead?.id}`) })}>
              Create follow-up
            </Pill>
          </Track>
          {reasons.length > 0 && <p className="text-xs text-muted-foreground">{reasons.join(' · ')}</p>}
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
          <DeskSection title="Solicitante">
            <Facts items={[
              { label: 'Nombre', value: app.applicantName || '-' },
              { label: 'Email', value: app.applicantEmail || '-' },
              { label: 'Teléfono', value: app.applicantPhone ? formatPhone(app.applicantPhone) : '-' },
              { label: 'Situación laboral', value: employmentLabel(app.employmentStatus) },
              { label: 'Ingreso anual', value: formatCents(app.annualIncomeCents) },
              { label: 'Situación crediticia (declarada)', value: creditTierLabel(app.selfReportedCreditTier) },
              { label: 'Consentimiento', value: formatDateTime(app.consentAt, timeZone) },
              { label: 'Bloqueada', value: formatDateTime(app.lockedAt, timeZone) },
            ]} />
          </DeskSection>

          <DeskSection title="Solicitud">
            <Facts items={[
              { label: 'Vehículo', value: app.vehicle ? <Link className="hover:underline" href={`${basePath}/platform/vehicles`}>{vehicleName(app.vehicle)}{app.vehicle.trim ? ` ${app.vehicle.trim}` : ''}</Link> : 'Sin elegir' },
              app.vehicle?.stockNumber ? { label: 'Stock', value: <Code className="text-foreground">#{app.vehicle.stockNumber}</Code> } : null,
              app.vehicle?.vin ? { label: 'VIN / chasis', value: <Code className="text-foreground">{app.vehicle.vin}</Code> } : null,
              { label: 'Precio del vehículo', value: formatCents(app.vehicle?.priceCents ?? null) },
              { label: 'Monto solicitado', value: formatCents(app.requestedAmountCents) },
              { label: 'Anticipo', value: formatCents(app.plannedDownPaymentCents) },
              { label: 'Usado', value: formatCents(app.tradeInValueCents) },
              { label: 'Cuota deseada', value: formatCents(app.plannedMonthlyPaymentCents) },
              { label: 'Tasa · plazo', value: `${formatApr(app.aprBasisPoints)} · ${app.loanTermMonths ?? '-'} mo` },
            ]} />
          </DeskSection>
        </div>

        <ReadoutStrip>
          <Readout label="Solicitado" value={formatCents(app.requestedAmountCents)} />
          <Readout label="Anticipo" value={formatCents(app.plannedDownPaymentCents)} />
          <Readout label="Envíos" value={app.submissions.length} tone={app.submissions.some(item => item.status === 'queued') ? 'warn' : 'idle'} />
          <Readout label="Última aprobación" value={latestApproval ? formatCents(latestApproval.approvedAmountCents) : '-'} tone={latestApproval ? 'ok' : 'idle'} sub={latestApproval ? `${formatApr(latestApproval.aprBasisPoints)} · ${latestApproval.termMonths ?? '-'} mo` : undefined} />
        </ReadoutStrip>

        <DeskSection title="Envíos a entidades" count={app.submissions.length}>
          {app.submissions.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">Sin enviar a una entidad</p>
          ) : (
            <DeskTable>
              <thead>
                <tr>
                  <Th>Entidad</Th>
                  <Th>Estado</Th>
                  <Th priority={2}>Enviada</Th>
                  <Th priority={3}>Enviado</Th>
                  <Th priority={2}>Referencia</Th>
                  <Th priority={3} align="right">Decisiones</Th>
                  <Th align="right"><span className="sr-only">Acciones</span></Th>
                </tr>
              </thead>
              <tbody>
                {app.submissions.map(submission => {
                  const decided = app.decisions.filter(decision => decision.submission?.id === submission.id)
                  const manual = submission.providerKey === 'operator-recorded' && submission.status === 'queued'
                  return (
                    <Tr key={submission.id}>
                      <Td className="font-medium">{providerLabels[submission.providerKey] || submission.providerKey}</Td>
                      <Td>
                        <Status tone={submission.status === 'submitted' ? 'ok' : stateTone(submission.status)}>{submission.status === 'submitted' ? 'Enviado' : label(submission.status)}</Status>
                        {submission.errorCode && <p className="mt-0.5 break-words text-xs text-muted-foreground">{submission.errorCode}</p>}
                      </Td>
                      <Td priority={2} className="whitespace-nowrap text-muted-foreground">{formatDateTime(submission.queuedAt, timeZone)}</Td>
                      <Td priority={3} className="whitespace-nowrap text-muted-foreground">{submission.submittedAt ? formatDateTime(submission.submittedAt, timeZone) : '-'}</Td>
                      <Td priority={2}>{submission.externalReference ? <Code>{submission.externalReference}</Code> : '-'}</Td>
                      <Td priority={3} align="right">{decided.length}</Td>
                      <Td align="right">
                        {manual && (
                          <span className="inline-flex flex-wrap justify-end gap-2">
                            <Pill size="sm" variant="primary" className="max-md:h-10" disabled={busy} onClick={() => start({ kind: 'sent', submission, values: { reference: '' }, idempotencyKey: newIdempotencyKey(`lender-sent:${submission.id}`) })}>Marcar enviada</Pill>
                            <Pill size="sm" className="max-md:h-10" disabled={busy} onClick={() => start({ kind: 'failed', submission, values: { reason: '' }, idempotencyKey: newIdempotencyKey(`lender-failed:${submission.id}`) })}>Marcar fallida</Pill>
                          </span>
                        )}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </DeskTable>
          )}
        </DeskSection>

        <DeskSection title="Decisiones de entidades" count={app.decisions.length}>
          {app.decisions.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">Sin decisiones</p>
          ) : (
            <DeskTable>
              <thead>
                <tr>
                  <Th>Decisión</Th>
                  <Th priority={2}>Decidido</Th>
                  <Th priority={3}>Referencia</Th>
                  <Th priority={3}>Motivos</Th>
                  <Th align="right">Aprobada</Th>
                  <Th priority={2} align="right">Tasa · plazo</Th>
                  <Th priority={3} align="right">Pago</Th>
                </tr>
              </thead>
              <tbody>
                {app.decisions.map(decision => (
                  <Tr key={decision.id}>
                    <Td>
                      <Status tone={stateTone(decision.decision)}>{decisionLabels[decision.decision] || decision.decision}</Status>
                      {decision.recordedBy?.name && <p className="mt-0.5 text-xs text-muted-foreground">{decision.recordedBy.name}</p>}
                    </Td>
                    <Td priority={2} className="whitespace-nowrap text-muted-foreground">{formatDateTime(decision.decidedAt, timeZone)}</Td>
                    <Td priority={3}>{decision.externalReference ? <Code>{decision.externalReference}</Code> : '-'}</Td>
                    <Td priority={3} className="text-muted-foreground">{decision.reasonCodes?.length ? decision.reasonCodes.join(', ') : '-'}</Td>
                    <Td align="right"><Figure size="sm">{formatCents(decision.approvedAmountCents)}</Figure></Td>
                    <Td priority={2} align="right" className="whitespace-nowrap">{formatApr(decision.aprBasisPoints)} · {decision.termMonths ?? '-'} mo</Td>
                    <Td priority={3} align="right">{formatCents(decision.monthlyPaymentCents)}</Td>
                  </Tr>
                ))}
              </tbody>
            </DeskTable>
          )}
        </DeskSection>

        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
          <DeskSection
            title="Consulta"
            actions={app.lead ? <Track><Pill size="sm" asChild><Link href={`${basePath}/platform/crm/${app.lead.id}`}>Abrir consulta</Link></Pill></Track> : undefined}
          >
            {app.lead ? (
              <ul className="divide-y text-sm">
                {app.lead.tasks.length === 0 && <li className="py-2 text-muted-foreground">Sin tareas</li>}
                {app.lead.tasks.map(task => (
                  <li key={task.id} className="flex min-w-0 items-center justify-between gap-4 py-2">
                    <TitleLine as="p" tone={task.completed ? 'ok' : 'warn'} status={task.completed ? 'Listo' : 'Abierta'}>{task.title || 'Tarea'}</TitleLine>
                    <p className="shrink-0 text-xs tabular-nums text-muted-foreground">{task.completed ? 'Listo' : formatDay(task.dueDate, timeZone)}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="py-3 text-sm text-muted-foreground">Sin consulta</p>}
          </DeskSection>

          <DeskSection
            title="Operaciones"
            count={app.lead?.deals.length ?? 0}
            actions={<Track><Pill size="sm" asChild><Link href={`${basePath}/platform/deals/create`}>Nueva operación</Link></Pill></Track>}
          >
            {(app.lead?.deals || []).length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Sin operaciones para esta consulta</p>
            ) : (
              <ul className="divide-y text-sm">
                {app.lead!.deals.map(deal => (
                  <li key={deal.id} className="flex min-w-0 items-center justify-between gap-4 py-2">
                    <TitleLine as="p" tone={stateTone(deal.status)} status={deal.status || undefined} className="capitalize">{deal.status || 'pencil'}</TitleLine>
                    <Track className="shrink-0"><Pill size="sm" asChild><Link href={`${basePath}/platform/deals/${deal.id}`}>Abierta</Link></Pill></Track>
                  </li>
                ))}
              </ul>
            )}
          </DeskSection>
        </div>

        <FinanceFormDialog
          open={Boolean(dialog)}
          title={dialog ? dialogTitles[dialog.kind] : ''}
          fields={fields}
          values={dialog?.values || {}}
          errors={fieldErrors}
          error={formError}
          busy={busy}
          onValuesChange={values => setDialog(current => current ? { ...current, values } as DialogState : current)}
          onSubmit={submit}
          onOpenChange={open => { if (!open && !busy) setDialog(null) }}
        />
      </div>
    </PageContainer>
  )
}
