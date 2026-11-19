'use server'

import { openfrontClient } from '../lib/config'
import { getAuthHeaders } from '../lib/data/cookies'
import { DEMO_SUBMISSION_MESSAGE, isDemoMode } from '@/features/lib/demoMode'
import { getGraphQLEndpoint } from '../lib/getBaseUrl'
import { getServerGraphQLTarget } from '@/features/dashboard/lib/getBaseUrl'

export type StorefrontSubmissionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string | null }

type SubmissionPayload = {
  ok: boolean
  errorCode?: string | null
  errorMessage?: string | null
}

type CommonSubmissionInput = {
  rooftopSlug: string
  idempotencyKey: string
  website?: string
}

const SUBMISSION_FAILED = 'No pudimos enviar la solicitud. Intentá de nuevo.'

async function executeSubmission<T extends SubmissionPayload>(
  field: string,
  document: string,
  input: CommonSubmissionInput & Record<string, unknown>
): Promise<StorefrontSubmissionResult<T>> {
  if (isDemoMode()) return { success: false, error: DEMO_SUBMISSION_MESSAGE, code: 'demo-mode' }
  let response: Record<string, T>
  try {
    response = await openfrontClient.request<Record<string, T>>(
      document,
      { data: { ...input, idempotencyKey: input.idempotencyKey.trim() } },
      await getAuthHeaders()
    )
  } catch {
    return { success: false, error: SUBMISSION_FAILED }
  }
  const payload = response[field]
  if (!payload?.ok) {
    return {
      success: false,
      error: payload?.errorMessage || SUBMISSION_FAILED,
      code: payload?.errorCode,
    }
  }
  return { success: true, data: payload }
}

export async function submitStorefrontInquiry(input: CommonSubmissionInput & {
  firstName: string
  lastName: string
  email: string
  phone?: string
  preferredContact: string
  intent: string
  message?: string
  vehicleId?: string
}) {
  return executeSubmission<SubmissionPayload & { leadId?: string; reused?: boolean }>(
    'submitInquiry',
    `mutation SubmitInquiry($data: SubmitInquiryInput!) {
      submitInquiry(data: $data) {
        ok errorCode errorMessage leadId intent intentLabel preferredContact reused
        selectedVehicle { id vin stockNumber year make model price status }
      }
    }`,
    input
  )
}

export async function reserveStorefrontVehicle(input: CommonSubmissionInput & {
  firstName: string
  lastName: string
  email: string
  phone: string
  message?: string
  vehicleId: string
}) {
  return executeSubmission<SubmissionPayload & { leadId?: string; amountCents?: number; checkoutUrl?: string; reused?: boolean }>(
    'reserveVehicle',
    `mutation ReserveVehicle($data: ReserveVehicleInput!) {
      reserveVehicle(data: $data) {
        ok errorCode errorMessage leadId amountCents checkoutUrl reused
      }
    }`,
    input
  )
}

export async function submitStorefrontTestDrive(input: CommonSubmissionInput & {
  customerName: string
  customerEmail: string
  customerPhone: string
  preferredDate: string
  preferredTime: string
  vehicleId?: string
  message?: string
}) {
  return executeSubmission<SubmissionPayload & { testDriveId?: string; leadId?: string; reused?: boolean }>(
    'submitTestDrive',
    `mutation SubmitTestDrive($data: SubmitTestDriveInput!) {
      submitTestDrive(data: $data) {
        ok errorCode errorMessage testDriveId leadId scheduledTime reused
        vehicle { id vin stockNumber year make model price status }
      }
    }`,
    input
  )
}

export async function submitStorefrontTradeIn(input: CommonSubmissionInput & {
  firstName: string
  lastName: string
  email: string
  phone: string
  year: number
  make: string
  model: string
  trim?: string
  vin?: string
  mileage: number
  condition: string
  ownership: string
  payoffAmount?: number
  notes?: string
  interestedVehicleId?: string
}) {
  return executeSubmission<SubmissionPayload & {
    photoToken?: string | null
    tradeInId?: string
    leadId?: string
    estimatedMin?: number
    estimatedMax?: number
    estimateMode?: string
    providerRequestSent?: boolean
    reused?: boolean
  }>(
    'submitTradeIn',
    `mutation SubmitTradeIn($data: SubmitTradeInInput!) {
      submitTradeIn(data: $data) {
        ok errorCode errorMessage tradeInId leadId estimatedMin estimatedMax
        estimateMode providerRequestSent reused photoToken
        vehicle { id vin stockNumber year make model price status }
      }
    }`,
    input
  )
}

export async function submitStorefrontFinancing(input: CommonSubmissionInput & {
  fullName: string
  email: string
  phone: string
  employmentStatus: string
  annualIncome: number
  creditTier: string
  requestedAmount?: number | null
  monthlyPayment?: number | null
  downPayment?: number
  tradeInValue?: number
  apr?: number
  loanTerm?: number
  vehicleId?: string
  consent: boolean
  privacyAcknowledged: boolean
}) {
  return executeSubmission<SubmissionPayload & {
    applicationId?: string
    applicationReference?: string
    leadId?: string
    taskId?: string
    providerMode?: string
    providerRequestSent?: boolean
    reused?: boolean
  }>(
    'submitFinancing',
    `mutation SubmitFinancing($data: SubmitFinancingInput!) {
      submitFinancing(data: $data) {
        ok errorCode errorMessage applicationId applicationReference leadId taskId
        followUpDueAt applicationStatus providerMode providerRequestSent reused
        vehicle { id vin stockNumber year make model price status }
      }
    }`,
    input
  )
}

export async function submitStorefrontService(input: CommonSubmissionInput & {
  customerName: string
  customerEmail: string
  customerPhone: string
  appointmentDate: string
  appointmentTime: string
  serviceType: string
  vehicleYear: number
  vehicleMake: string
  vehicleModel: string
  vehicleVin?: string
  description?: string
  servicePackageId?: string
}) {
  return executeSubmission<SubmissionPayload & {
    serviceAppointmentId?: string
    leadId?: string
    requestedServiceLabel?: string
    reused?: boolean
  }>(
    'submitServiceBooking',
    `mutation SubmitServiceBooking($data: SubmitServiceBookingInput!) {
      submitServiceBooking(data: $data) {
        ok errorCode errorMessage serviceAppointmentId leadId appointmentDate
        serviceType status requestedServiceLabel reused
      }
    }`,
    input
  )
}

const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Sube una foto de "Vendelo en Elvis" usando el código temporal devuelto al enviar el formulario. */
export async function uploadStorefrontTradeInPhoto(formData: FormData): Promise<StorefrontSubmissionResult<{ count: number }>> {
  if (isDemoMode()) return { success: false, error: DEMO_SUBMISSION_MESSAGE, code: 'demo-mode' }
  const tradeInId = String(formData.get('tradeInId') || '')
  const photoToken = String(formData.get('photoToken') || '')
  const photo = formData.get('photo')
  if (!tradeInId || !photoToken || !(photo instanceof File) || photo.size === 0) return { success: false, error: 'Elegí una foto.' }
  if (!PHOTO_TYPES.has(photo.type) || photo.size > 8 * 1024 * 1024) return { success: false, error: 'Las fotos deben ser JPG, PNG o WebP de hasta 8 MB.' }
  const query = `mutation AttachTradeInPhoto($tradeInId: ID!, $photoToken: String!, $photo: ImageFieldInput!) {
    attachTradeInPhoto(tradeInId: $tradeInId, photoToken: $photoToken, photo: $photo) { ok errorCode errorMessage count }
  }`
  try {
    const form = new FormData()
    form.append('operations', JSON.stringify({ query, variables: { tradeInId, photoToken, photo: { upload: null } } }))
    form.append('map', JSON.stringify({ 1: ['variables.photo.upload'] }))
    form.append('1', photo, photo.name || 'foto.jpg')
    const target = process.env.NEXT_PUBLIC_BACKEND_URL
      ? { endpoint: await getGraphQLEndpoint(), fetch: undefined }
      : await getServerGraphQLTarget()
    const response = await (target.fetch ?? fetch)(target.endpoint, {
      method: 'POST',
      headers: { 'apollo-require-preflight': 'true' },
      body: form,
      redirect: 'error',
      cache: 'no-store',
    })
    const json = await response.json().catch(() => null) as { data?: { attachTradeInPhoto?: { ok: boolean; errorMessage?: string | null; count?: number | null } } } | null
    const payload = json?.data?.attachTradeInPhoto
    if (!payload?.ok) return { success: false, error: payload?.errorMessage || 'No pudimos subir la foto.' }
    return { success: true, data: { count: Number(payload.count) || 0 } }
  } catch {
    return { success: false, error: 'No pudimos subir la foto.' }
  }
}
