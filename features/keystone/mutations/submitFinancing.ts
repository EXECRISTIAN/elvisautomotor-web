import { resolveCustomerInTransaction } from './customerIdentity'
import { buildFinancingLeadContent } from './financingPrivacy'
import { dollarsToCents, financingReference } from './financingUtils'
import { publicSubmissionIdempotencyKey, runPublicSubmission } from './publicSubmissionPolicy'
import { SubmissionError } from './submissionErrors'
import { loadActiveFinancingPlans } from './publicFinancingPlans'
import { simulate } from '../../lib/financing/simulate'
import {
  finiteNumber,
  requiredText,
  resolveAvailableVehicle,
  splitCustomerName,
  validEmail,
  validPhone,
} from './submissionUtils'

const LEGACY_LOAN_TERMS = new Set([12, 18, 24, 36, 48, 60, 72, 84])
const MAX_AMOUNT = 100_000_000_000 // pesos

function budgetRange(amount: number) {
  if (amount < 20_000_000) return 'under-20k'
  if (amount < 100_000_000) return '20-30k'
  return 'over-100k'
}

export async function submitFinancing(_root: unknown, { data }: { data: any }, context: any) {
  const fullName = requiredText(data.fullName, 'Nombre completo', 200)
  const email = validEmail(data.email)
  const phone = validPhone(data.phone)
  const employmentStatus = requiredText(data.employmentStatus, 'Situación laboral', 100)
  const creditTier = requiredText(data.creditTier, 'Situación crediticia', 100)
  const annualIncome = finiteNumber(data.annualIncome, 'Ingresos', { min: 1, max: MAX_AMOUNT })
  let requestedAmount = data.requestedAmount == null
    ? null
    : finiteNumber(data.requestedAmount, 'Monto a financiar', { min: 0, max: MAX_AMOUNT })
  let monthlyPayment = data.monthlyPayment == null
    ? null
    : finiteNumber(data.monthlyPayment, 'Cuota', { min: 0, max: MAX_AMOUNT })
  const downPayment = finiteNumber(data.downPayment || 0, 'Anticipo', { min: 0, max: MAX_AMOUNT })
  const tradeInValue = finiteNumber(data.tradeInValue || 0, 'Valor del usado', { min: 0, max: MAX_AMOUNT })
  let apr = finiteNumber(data.apr || 0, 'Tasa', { min: 0, max: 1000 })
  const loanTerm = finiteNumber(data.loanTerm || 0, 'Plazo', { min: 0, max: 120, integer: true })
  if (data.consent !== true) {
    throw new SubmissionError('Tienes que aceptar que te contactemos.')
  }
  if (data.privacyAcknowledged !== true) {
    throw new SubmissionError('Tienes que aceptar el aviso de privacidad.')
  }
  // Plan elegido en el simulador: se valida contra los planes vigentes y se recalcula en el servidor.
  const financingPlanId = data.financingPlanId ? String(data.financingPlanId) : ''
  let plan: Awaited<ReturnType<typeof loadActiveFinancingPlans>>[number] | null = null
  if (financingPlanId) {
    plan = (await loadActiveFinancingPlans(context)).find((item: any) => item.id === financingPlanId) || null
    if (!plan) throw new SubmissionError('El plan elegido ya no está vigente. Vuelve a simular.')
    // El plazo (de la lista del banco o una cantidad personalizada dentro de su rango) lo valida simulate().
    const price = finiteNumber(data.vehiclePrice, 'Precio del vehículo', { min: 1, max: MAX_AMOUNT })
    const result = simulate(plan as any, { priceCents: Math.round(price * 100), downPaymentCents: Math.round(downPayment * 100), termMonths: loanTerm })
    if (!result.ok) throw new SubmissionError(result.reason)
    requestedAmount = result.financedCents / 100
    monthlyPayment = result.firstInstallmentCents / 100
    apr = plan.tnaBps / 100
  } else if (loanTerm && !LEGACY_LOAN_TERMS.has(loanTerm)) {
    throw new SubmissionError('El plazo elegido no es válido.')
  }
  const privacyAcknowledged = true

  const idempotencyKey = publicSubmissionIdempotencyKey(data.idempotencyKey)
  const { firstName, lastName } = splitCustomerName(fullName, 'Finance', 'Applicant')

  return runPublicSubmission({
    context,
    workflow: 'financing',
    rooftopSlug: data.rooftopSlug,
    idempotencyKey,
    honeypot: data.website,
    requestEvidence: {
      fullName,
      email,
      phone,
      employmentStatus,
      creditTier,
      annualIncome,
      requestedAmount,
      monthlyPayment,
      downPayment,
      tradeInValue,
      apr,
      loanTerm,
      financingPlanId: financingPlanId || null,
      vehicleId: data.vehicleId || null,
      consent: true,
      privacyAcknowledged,
    },
    aggregateType: 'FinancingApplication',
    aggregateId: result => String(result.applicationId),
    handler: async (transactionContext, { rooftopId }) => {
      const vehicle = await resolveAvailableVehicle(transactionContext, data.vehicleId, rooftopId)
      // Si la solicitud es por un auto del inventario, el precio sale de la publicación (no del navegador).
      if (plan && vehicle && Number(vehicle.priceCents) > 0) {
        const result = simulate(plan as any, { priceCents: Math.round(Number(vehicle.priceCents)), downPaymentCents: Math.round(downPayment * 100), termMonths: loanTerm })
        if (!result.ok) throw new SubmissionError(result.reason)
        requestedAmount = result.financedCents / 100
        monthlyPayment = result.firstInstallmentCents / 100
      }
      const sudo = transactionContext.sudo()
      const existing = await sudo.query.FinancingApplication.findMany({
        where: { idempotencyKey: { equals: idempotencyKey } },
        take: 1,
        query: `
          id reference rooftop { id }
          lead { id tasks(orderBy: { createdAt: desc }, take: 1) { id dueDate } }
          vehicle { id vin stockNumber year make model price status }
        `,
      })
      if (existing.length) {
        const application = existing[0]
        if (application.rooftop?.id !== rooftopId) throw new SubmissionError('La solicitud no es válida. Recarga la página e intenta de nuevo.', 409, 'IDEMPOTENCY_CONFLICT')
        const task = application.lead?.tasks?.[0]
        return {
          applicationId: application.id,
          applicationReference: application.reference,
          leadId: application.lead?.id || null,
          taskId: task?.id || null,
          followUpDueAt: task?.dueDate ? new Date(task.dueDate) : null,
          vehicle: application.vehicle || null,
          applicationStatus: 'submitted',
          providerMode: 'operator-recorded',
          providerRequestSent: false,
        }
      }

      const due = new Date()
      due.setDate(due.getDate() + 1)
      const now = new Date()
      const reference = financingReference()
      const requestedAmountCents = requestedAmount == null ? null : dollarsToCents(requestedAmount, 'Requested amount')
      const plannedMonthlyPaymentCents = monthlyPayment == null ? null : dollarsToCents(monthlyPayment, 'Monthly payment')
      const plannedDownPaymentCents = dollarsToCents(downPayment, 'Down payment')
      const tradeInValueCents = dollarsToCents(tradeInValue, 'Trade-in value')
      const annualIncomeCents = dollarsToCents(annualIncome, 'Annual income', true)
      const aprBasisPoints = Math.round(apr * 100)
      const rooftop = { connect: { id: rooftopId } }
      const vehicleSummary = vehicle
        ? `${vehicle.year} ${vehicle.make} ${vehicle.model} (stock ${vehicle.stockNumber}, VIN ${vehicle.vin})`
        : 'Sin vehículo elegido'
      const { notes, taskDescription } = buildFinancingLeadContent({
        vehicleSummary,
        requestedAmount,
        monthlyPayment,
        downPayment,
        tradeInValue,
        apr,
        loanTerm,
        plan: plan ? { bankName: plan.bankName, name: plan.name, tnaBps: plan.tnaBps, cftBps: plan.cftBps, amortization: plan.amortization } : null,
      })
      const { customer } = await resolveCustomerInTransaction(transactionContext, {
        rooftopId,
        firstName,
        lastName,
        email,
        phone,
      })
      const lead = await sudo.query.Lead.createOne({
        data: {
          rooftop,
          customer: { connect: { id: customer.id } },
          firstName,
          lastName,
          email,
          phone,
          source: 'website',
          status: 'new',
          timeframe: 'immediately',
          ...(requestedAmount != null && requestedAmount > 0 ? { budgetRange: budgetRange(requestedAmount) } : {}),
          notes,
          ...(vehicle ? { interestedVehicle: { connect: { id: vehicle.id } } } : {}),
          tasks: {
            create: [{
              rooftop,
              title: `Seguimiento de financiación: ${fullName}`,
              description: taskDescription,
              priority: 'high',
              completed: false,
              dueDate: due.toISOString(),
            }],
          },
        },
        query: 'id tasks(orderBy: { createdAt: desc }, take: 1) { id dueDate }',
      })
      const immutableSnapshot = {
        version: 2,
        reference,
        applicant: {
          fullName,
          email,
          phone,
          employmentStatus,
          annualIncomeCents,
          selfReportedCreditTier: creditTier,
        },
        requestedTerms: {
          requestedAmountCents,
          plannedMonthlyPaymentCents,
          plannedDownPaymentCents,
          tradeInValueCents,
          aprBasisPoints,
          loanTermMonths: loanTerm || null,
        },
        plan: plan ? { id: plan.id, bankName: plan.bankName, name: plan.name, tnaBps: plan.tnaBps, teaBps: plan.teaBps, cftBps: plan.cftBps, amortization: plan.amortization, estimateOnly: true } : null,
        vehicle: vehicle ? {
          id: vehicle.id,
          vin: vehicle.vin,
          stockNumber: vehicle.stockNumber,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
        } : null,
        consentAt: now.toISOString(),
        privacyAcknowledgedAt: privacyAcknowledged ? now.toISOString() : null,
        providerMode: 'operator-recorded',
        providerRequestSent: false,
      }
      const application = await sudo.query.FinancingApplication.createOne({
        data: {
          rooftop,
          reference,
          idempotencyKey,
          status: 'submitted',
          lead: { connect: { id: lead.id } },
          ...(vehicle ? { vehicle: { connect: { id: vehicle.id } } } : {}),
          applicantName: fullName,
          applicantEmail: email,
          applicantPhone: phone,
          employmentStatus,
          annualIncomeCents,
          selfReportedCreditTier: creditTier,
          requestedAmountCents,
          plannedMonthlyPaymentCents,
          plannedDownPaymentCents,
          tradeInValueCents,
          aprBasisPoints,
          loanTermMonths: loanTerm || null,
          consentAt: now.toISOString(),
          submittedAt: now.toISOString(),
          lockedAt: now.toISOString(),
          immutableSnapshot,
        },
        query: 'id reference',
      })
      const task = lead.tasks[0]
      return {
        applicationId: application.id,
        applicationReference: application.reference,
        leadId: lead.id,
        taskId: task.id,
        followUpDueAt: task.dueDate ? new Date(task.dueDate) : null,
        vehicle,
        applicationStatus: 'submitted',
        providerMode: 'operator-recorded',
        providerRequestSent: false,
      }
    },
  })
}
