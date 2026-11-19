import { resolveCustomerInTransaction } from './customerIdentity'
import { runPublicSubmission } from './publicSubmissionPolicy'
import { SubmissionError } from './submissionErrors'
import { issueTradeInPhotoToken } from './tradeInPhotos'
import {
  finiteNumber,
  formatCurrency,
  optionalText,
  requiredText,
  resolveAvailableVehicle,
  validEmail,
  validPhone,
} from './submissionUtils'

const CONDITIONS = new Set(['excellent', 'good', 'fair', 'poor'])
const OWNERSHIP = new Set(['own', 'financing', 'lease'])

// Elvis Automotores: no se calcula un "rango preliminar" automático (sería un valor ficticio).
// La tasación la hace el personal y se informa al cliente por separado.

export async function submitTradeIn(_root: unknown, { data }: { data: any }, context: any) {
  const firstName = requiredText(data.firstName, 'Nombre', 100)
  const lastName = requiredText(data.lastName, 'Apellido', 100)
  const email = validEmail(data.email)
  const phone = validPhone(data.phone)
  const year = finiteNumber(data.year, 'Año', {
    min: 1980,
    max: new Date().getFullYear() + 1,
    integer: true,
  })
  const mileage = finiteNumber(data.mileage, 'Kilometraje', { min: 0, max: 2_000_000, integer: true })
  const make = requiredText(data.make, 'Marca', 100)
  const model = requiredText(data.model, 'Modelo', 100)
  const trim = optionalText(data.trim, 100, 'Trim')
  const vin = optionalText(data.vin, 17, 'VIN').toUpperCase()
  const condition = requiredText(data.condition, 'Estado', 30)
  const ownership = requiredText(data.ownership, 'Titularidad', 30)
  const notes = optionalText(data.notes, 2000, 'Información adicional')
  const payoffAmount = finiteNumber(data.payoffAmount || 0, 'Saldo del crédito', { min: 0, max: 10_000_000_000 })
  if (!CONDITIONS.has(condition) || !OWNERSHIP.has(ownership)) {
    throw new SubmissionError('El estado o la titularidad no son válidos.')
  }
  if (vin && (vin.length !== 17 || /[IOQ]/.test(vin))) {
    throw new SubmissionError('Si cargas el número de chasis, debe tener 17 caracteres.')
  }

  const summary = `${year} ${make} ${model}${trim ? ` ${trim}` : ''}`

  const outcome: any = await runPublicSubmission({
    context,
    workflow: 'trade-in',
    rooftopSlug: data.rooftopSlug,
    idempotencyKey: data.idempotencyKey,
    honeypot: data.website,
    requestEvidence: {
      firstName,
      lastName,
      email,
      phone,
      year,
      mileage,
      make,
      model,
      trim,
      vin,
      condition,
      ownership,
      payoffAmount,
      notes,
      interestedVehicleId: optionalText(data.interestedVehicleId, 100, 'Interested vehicle'),
    },
    aggregateType: 'TradeIn',
    aggregateId: result => String(result.tradeInId),
    handler: async (transactionContext, { rooftopId }) => {
      const vehicle = await resolveAvailableVehicle(transactionContext, data.interestedVehicleId, rooftopId)
      const interested = vehicle
        ? `${vehicle.year} ${vehicle.make} ${vehicle.model} (stock ${vehicle.stockNumber}, VIN ${vehicle.vin})`
        : 'Ninguno'
      const rooftop = { connect: { id: rooftopId } }
      const { customer } = await resolveCustomerInTransaction(transactionContext, {
        rooftopId,
        firstName,
        lastName,
        email,
        phone,
      })
      const tradeIn = await transactionContext.sudo().query.TradeIn.createOne({
        data: {
          rooftop,
          vin,
          year: String(year),
          make,
          model,
          trim,
          mileage,
          condition,
          exteriorCondition: notes || 'Solicitud web; falta inspección del exterior.',
          interiorCondition: `Ownership: ${ownership}${payoffAmount > 0 ? `; customer-reported payoff: ${formatCurrency(payoffAmount)}` : ''}`,
          lead: {
            create: {
              rooftop,
              customer: { connect: { id: customer.id } },
              firstName,
              lastName,
              email,
              phone,
              source: 'website',
              status: 'new',
              timeframe: 'immediately',
              tradeInVehicle: summary,
              notes: [
                `Usado ofrecido desde la web: ${summary}, ${mileage} km.`,
                `Titularidad: ${ownership}${payoffAmount > 0 ? `; saldo del crédito informado: ${formatCurrency(payoffAmount)}` : ''}.`,
                ...(notes ? [`Información del cliente: ${notes}`] : []),
                `Vehículo de interés: ${interested}.`,
              ].join('\n'),
              ...(vehicle ? { interestedVehicle: { connect: { id: vehicle.id } } } : {}),
            },
          },
        },
        query: 'id lead { id }',
      })
      return {
        tradeInId: tradeIn.id,
        leadId: tradeIn.lead.id,
        estimatedMin: null,
        estimatedMax: null,
        estimateMode: 'manual-appraisal',
        providerRequestSent: false,
        vehicle,
      }
    },
  })
  // El código para adjuntar fotos se emite fuera de la transacción y no queda en la auditoría.
  const photoToken = !outcome.reused && outcome.tradeInId ? await issueTradeInPhotoToken(context, String(outcome.tradeInId)) : null
  return { ...outcome, photoToken }
}
