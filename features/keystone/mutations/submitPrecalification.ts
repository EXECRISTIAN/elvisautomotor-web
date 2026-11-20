import { resolveCustomerInTransaction } from './customerIdentity'
import { runPublicSubmission } from './publicSubmissionPolicy'
import { SubmissionError } from './submissionErrors'
import { optionalText, requiredText, validPhone } from './submissionUtils'

// Precalificador de Elvis: preguntas guiadas (0 km / usado, forma de pago, permuta, cuota,
// situación laboral, ingresos, crédito) y datos de contacto. Queda como una consulta en el panel
// con un resumen legible para el vendedor. No consulta bancos ni burós: solo registra lo que dice el cliente.

const TIMES: Record<string, string> = { morning: 'por la mañana', afternoon: 'por la tarde' }

export async function submitPrecalification(_root: unknown, { data }: { data: any }, context: any) {
  const fullName = requiredText(data.fullName, 'Nombre y apellido', 160)
  const [firstName, ...rest] = fullName.split(/\s+/)
  const lastName = rest.join(' ') || '-'
  const phone = validPhone(data.phone)
  const dni = optionalText(data.dni, 12, 'DNI').replace(/\D/g, '')
  const cuil = optionalText(data.cuil, 15, 'CUIL').replace(/\D/g, '')
  const locality = optionalText(data.locality, 100, 'Localidad')
  const province = optionalText(data.province, 100, 'Provincia')
  const message = optionalText(data.message, 2000, 'Mensaje')
  if (dni && (dni.length < 7 || dni.length > 8)) throw new SubmissionError('El DNI debe tener 7 u 8 números.')
  if (cuil && cuil.length !== 11) throw new SubmissionError('El CUIL debe tener 11 números (XX-XXXXXXXX-X).')
  if (!data.consent) throw new SubmissionError('Necesitamos tu autorización para contactarte.')

  const answers = (Array.isArray(data.answers) ? data.answers : []).slice(0, 40).map((item: any) => ({
    question: optionalText(item?.question, 200, 'Pregunta'),
    answer: optionalText(item?.answer, 300, 'Respuesta'),
  })).filter((item: { question: string; answer: string }) => item.question && item.answer)
  if (!answers.length) throw new SubmissionError('Responde las preguntas antes de enviar.')
  const times = [...new Set((Array.isArray(data.contactTimes) ? data.contactTimes : []).map(String))].filter((t): t is string => typeof t === 'string' && t in TIMES)
  const timesLabel = times.map((t) => TIMES[t]).join(' o ')

  return runPublicSubmission({
    context,
    workflow: 'inquiry',
    rooftopSlug: data.rooftopSlug,
    idempotencyKey: data.idempotencyKey,
    honeypot: data.website,
    requestEvidence: { kind: 'precalificacion', fullName, phone, dni, cuil, locality, province, message, answers, times },
    aggregateType: 'Lead',
    aggregateId: result => String(result.leadId),
    handler: async (transactionContext, { rooftopId }) => {
      const { customer } = await resolveCustomerInTransaction(transactionContext, { rooftopId, firstName, lastName, email: '', phone })
      const notes = [
        'Precalificador completado desde la web.',
        `WhatsApp: ${phone}${timesLabel ? ` · Prefiere que lo contacten ${timesLabel}` : ''}.`,
        [dni && `DNI ${dni}`, cuil && `CUIL ${cuil.slice(0, 2)}-${cuil.slice(2, 10)}-${cuil.slice(10)}`, [locality, province].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
        '',
        ...answers.map((item: { question: string; answer: string }) => `• ${item.question} → ${item.answer}`),
        '',
        message ? `Mensaje del cliente: ${message}` : 'El cliente no dejó un mensaje adicional.',
      ].filter((line, index, all) => line !== '' || all[index - 1] !== '').join('\n')
      const lead = await transactionContext.sudo().query.Lead.createOne({
        data: {
          rooftop: { connect: { id: rooftopId } },
          customer: { connect: { id: customer.id } },
          firstName,
          lastName,
          phone,
          source: 'website',
          status: 'new',
          notes,
        },
        query: 'id',
      })
      return { leadId: lead.id }
    },
  })
}
