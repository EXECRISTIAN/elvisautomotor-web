'use client'

// Mismas funciones que actions/submissions, pero en la muestra local guardan en el navegador.
import * as server from '../actions/submissions'
import { isLocalDemo, newId, saveSubmission } from './localStore'

type Args<F> = F extends (input: infer A) => unknown ? A : never

function local<T>(kind: string, label: string, input: object, data: T) {
  saveSubmission(kind, label, input as Record<string, unknown>)
  return Promise.resolve({ success: true as const, data })
}

export const submitStorefrontInquiry = (input: Args<typeof server.submitStorefrontInquiry>) =>
  isLocalDemo() ? local('consulta', 'Consulta', input, { ok: true, leadId: newId('INQ'), intent: input.intent, intentLabel: 'Consulta', preferredContact: input.preferredContact, reused: false } as never) : server.submitStorefrontInquiry(input)

export const reserveStorefrontVehicle = (input: Args<typeof server.reserveStorefrontVehicle>) =>
  isLocalDemo() ? local('reserva', 'Pedido de reserva', input, { ok: true, leadId: newId('RES'), checkoutUrl: null } as never) : server.reserveStorefrontVehicle(input)

export const submitStorefrontTestDrive = (input: Args<typeof server.submitStorefrontTestDrive>) =>
  isLocalDemo() ? local('prueba', 'Prueba de manejo', input, { ok: true, testDriveId: newId('TD'), leadId: newId('LD') } as never) : server.submitStorefrontTestDrive(input)

export const submitStorefrontTradeIn = (input: Args<typeof server.submitStorefrontTradeIn>) =>
  isLocalDemo() ? local('usado', 'Usado ofrecido', input, { ok: true, tradeInId: newId('TRADE'), leadId: newId('LD'), photoToken: null } as never) : server.submitStorefrontTradeIn(input)

export const submitStorefrontFinancing = (input: Args<typeof server.submitStorefrontFinancing>) =>
  isLocalDemo() ? local('credito', 'Solicitud de crédito', input, { ok: true, applicationId: newId('FIN'), applicationReference: newId('FIN'), leadId: newId('LD') } as never) : server.submitStorefrontFinancing(input)

export const submitStorefrontService = (input: Args<typeof server.submitStorefrontService>) =>
  isLocalDemo() ? local('servicio', 'Turno de servicio', input, { ok: true, serviceAppointmentId: newId('SRV') } as never) : server.submitStorefrontService(input)

export const submitStorefrontPrecalification = (input: Args<typeof server.submitStorefrontPrecalification>) =>
  isLocalDemo() ? local('precalificacion', 'Precalificador', input, { ok: true, leadId: newId('PRE') } as never) : server.submitStorefrontPrecalification(input)

export const uploadStorefrontTradeInPhoto = (form: FormData) =>
  isLocalDemo() ? Promise.resolve({ success: true as const, data: { count: 0 } }) : server.uploadStorefrontTradeInPhoto(form)
