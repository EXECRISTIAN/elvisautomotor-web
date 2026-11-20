'use client'

// Mismas funciones que actions/submissions, pero en la muestra local guardan en el navegador.
import * as server from '../actions/submissions'
import { isLocalDemo, listSubmissions, newId, savePhoto, saveSubmission, updateSubmission } from './localStore'

type Args<F> = F extends (input: infer A) => unknown ? A : never

function local<T>(kind: string, label: string, input: object, data: T | ((id: string) => T)) {
  const item = saveSubmission(kind, label, input as Record<string, unknown>)
  return Promise.resolve({ success: true as const, data: typeof data === 'function' ? (data as (id: string) => T)(item.id) : data })
}

export const submitStorefrontInquiry = (input: Args<typeof server.submitStorefrontInquiry>) =>
  isLocalDemo() ? local('consulta', 'Consulta', input, { ok: true, leadId: newId('INQ'), intent: input.intent, intentLabel: 'Consulta', preferredContact: input.preferredContact, reused: false } as never) : server.submitStorefrontInquiry(input)

export const reserveStorefrontVehicle = (input: Args<typeof server.reserveStorefrontVehicle>) =>
  isLocalDemo() ? local('reserva', 'Pedido de reserva', input, { ok: true, leadId: newId('RES'), checkoutUrl: null } as never) : server.reserveStorefrontVehicle(input)

export const submitStorefrontTestDrive = (input: Args<typeof server.submitStorefrontTestDrive>) =>
  isLocalDemo() ? local('prueba', 'Prueba de manejo', input, { ok: true, testDriveId: newId('TD'), leadId: newId('LD') } as never) : server.submitStorefrontTestDrive(input)

export const submitStorefrontTradeIn = (input: Args<typeof server.submitStorefrontTradeIn>) =>
  isLocalDemo() ? local('usado', 'Usado ofrecido', input, ((id: string) => ({ ok: true, tradeInId: id, leadId: newId('LD'), photoToken: `local:${id}` })) as never) : server.submitStorefrontTradeIn(input)

export const submitStorefrontFinancing = (input: Args<typeof server.submitStorefrontFinancing>) =>
  isLocalDemo() ? local('credito', 'Solicitud de crédito', input, { ok: true, applicationId: newId('FIN'), applicationReference: newId('FIN'), leadId: newId('LD') } as never) : server.submitStorefrontFinancing(input)

export const submitStorefrontService = (input: Args<typeof server.submitStorefrontService>) =>
  isLocalDemo() ? local('servicio', 'Turno de servicio', input, { ok: true, serviceAppointmentId: newId('SRV') } as never) : server.submitStorefrontService(input)

export const submitStorefrontPrecalification = (input: Args<typeof server.submitStorefrontPrecalification>) =>
  isLocalDemo() ? local('precalificacion', 'Precalificador', input, { ok: true, leadId: newId('PRE') } as never) : server.submitStorefrontPrecalification(input)

// En la muestra local la foto se guarda en la carpeta "datos/fotos" y queda vinculada a la consulta.
export const uploadStorefrontTradeInPhoto = async (form: FormData) => {
  if (!isLocalDemo()) return server.uploadStorefrontTradeInPhoto(form)
  const token = String(form.get('photoToken') || '')
  const photo = form.get('photo')
  const id = token.replace(/^local:/, '')
  const item = listSubmissions().find((entry) => entry.id === id)
  if (!item || !(photo instanceof Blob)) return { success: false as const, error: 'No pudimos guardar la foto.' }
  const url = await savePhoto(photo)
  const photos = [...(item.photos ?? []), url]
  updateSubmission(id, { photos })
  return { success: true as const, data: { count: photos.length } }
}
