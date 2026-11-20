'use client'

import { PlatformSelect } from '@/features/platform/components/PlatformSelect'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { fetchGraphQL } from '@/features/storefront/lib/data/public-read'
import { GET_VEHICLE_BY_ID } from '@/features/storefront/lib/data/queries'
import type { Vehicle } from '@/features/storefront/lib/types'
import { submitStorefrontTradeIn, uploadStorefrontTradeInPhoto } from '../lib/submit'
import { WhatsAppButton } from '../components/WhatsAppButton'
import { ELVIS_INFO } from '../lib/elvisContent'
import { PageHeader } from '../components/PageHeader'
import { ComboField } from '../components/ComboField'
import { catalogMakes, catalogModels, catalogVersions } from '@/features/lib/vehicleCatalog'
import { useStorefrontBusiness } from '../components/StorefrontBusinessProvider'
import { formatMileage, formatPrice } from '../lib/format'
import { customerRequestReference } from '../lib/customerRequests'
import { transitionTradeInStep } from '../lib/tradeInForm'
import { fillBlankFields, useCustomerPrefill } from '../lib/useCustomerPrefill'
import { currencySymbol } from '../lib/format'
import {
  Field,
  FormSection,
  MobileSummary,
  Notice,
  RadioPills,
  RequestLayout,
  RequestReceived,
  Sticker,
  StickerVehicle,
  type StickerRowData,
} from '../components/forms/RequestForm'

// Marcas habituales en Argentina (el campo acepta cualquier otra).
const MAX_PHOTOS = 8

/** Achica la foto en el navegador (máx. 1600 px, JPEG) para que suba rápido desde el celular. */
async function shrinkPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file
  } catch {
    return file
  }
}
const currentYear = new Date().getFullYear()
// Matches the server's accepted range (1980 through next model year).
const OLDEST_TRADE_YEAR = 1980
const YEARS = Array.from({ length: currentYear + 1 - OLDEST_TRADE_YEAR + 1 }, (_, i) => currentYear + 1 - i)

const CONDITIONS = [
  { value: 'excellent', label: 'Excelente' },
  { value: 'good', label: 'Bueno' },
  { value: 'fair', label: 'Regular' },
  { value: 'poor', label: 'Malo' },
]

const OWNERSHIP = [
  { value: 'own', label: 'Propio, sin deuda' },
  { value: 'financing', label: 'Con crédito prendario' },
  { value: 'lease', label: 'Leasing' },
]

const STEPS = ['Vehículo', 'Estado y fotos', 'Contacto']

const EMPTY = {
  year: '',
  make: '',
  model: '',
  trim: '',
  mileage: '',
  licensePlate: '',
  engineNumber: '',
  vin: '',
  condition: 'good',
  ownership: 'own',
  payoffAmount: '',
  notes: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  website: '',
}

const optionLabel = (options: { value: string; label: string }[], value: string) =>
  options.find((option) => option.value === value)?.label ?? null

export function TradeInPage() {
  const business = useStorefrontBusiness()
  const searchParams = useSearchParams()
  const interestedVehicleId = searchParams?.get('vehicleId') || ''
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState(EMPTY)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [submitted, setSubmitted] = useState(false)
  const [submissionReference, setSubmissionReference] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [interestedVehicle, setInterestedVehicle] = useState<Vehicle | null>(null)
  const [photos, setPhotos] = useState<{ id: string; file: File; url: string }[]>([])
  const [photoNotice, setPhotoNotice] = useState<string | null>(null)
  const [photoProgress, setPhotoProgress] = useState<string | null>(null)
  const [uploadedPhotos, setUploadedPhotos] = useState(0)
  const prefill = useCustomerPrefill()
  const contactPrefill = prefill
    ? { firstName: prefill.firstName, lastName: prefill.lastName, email: prefill.email, phone: prefill.phone }
    : {}

  useEffect(() => {
    if (!prefill) return
    setFormData((prev) => fillBlankFields(prev, { firstName: prefill.firstName, lastName: prefill.lastName, email: prefill.email, phone: prefill.phone }))
  }, [prefill])

  useEffect(() => {
    if (!interestedVehicleId) {
      setInterestedVehicle(null)
      return
    }

    void fetchGraphQL<{ publicInventoryVehicle: Vehicle | null }>(GET_VEHICLE_BY_ID, { id: interestedVehicleId })
      .then((data) => setInterestedVehicle(data.publicInventoryVehicle ?? null))
      .catch(() => setInterestedVehicle(null))
  }, [interestedVehicleId])

  const submitTradeIn = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const result = await submitStorefrontTradeIn({
        ...formData,
        year: parseInt(formData.year),
        mileage: parseInt(formData.mileage) || 0,
        payoffAmount: parseFloat(formData.payoffAmount) || 0,
        interestedVehicleId,
        rooftopSlug: business.rooftopSlug,
        idempotencyKey,
      })
      if (!result.success) throw new Error(result.error)
      setSubmissionReference(customerRequestReference('trade-in', result.data.tradeInId))
      let uploaded = 0
      if (photos.length && result.data.tradeInId && result.data.photoToken) {
        for (const [index, photo] of photos.entries()) {
          setPhotoProgress(`Subiendo foto ${index + 1} de ${photos.length}…`)
          const form = new FormData()
          form.append('tradeInId', result.data.tradeInId)
          form.append('photoToken', result.data.photoToken)
          form.append('photo', await shrinkPhoto(photo.file))
          const upload = await uploadStorefrontTradeInPhoto(form).catch(() => null)
          if (upload?.success) uploaded += 1
        }
        setPhotoProgress(null)
      }
      setUploadedPhotos(uploaded)
      setIdempotencyKey(crypto.randomUUID())
      setSubmitted(true)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No pudimos enviar tu solicitud. Intenta de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const advanceStep = (currentStep: 1 | 2) => {
    const transition = transitionTradeInStep(currentStep, formData)
    setStepError(transition.error)
    setStep(transition.step)
  }

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (step === 1 || step === 2) {
      advanceStep(step)
      return
    }
    void submitTradeIn()
  }

  const goBack = (previousStep: 1 | 2) => {
    setStepError(null)
    setSubmitError(null)
    setStep(previousStep)
  }

  const reset = () => {
    setSubmitted(false)
    setStep(1)
    setFormData(fillBlankFields(EMPTY, contactPrefill))
    setSubmissionReference(null)
    photos.forEach((photo) => URL.revokeObjectURL(photo.url))
    setPhotos([])
    setUploadedPhotos(0)
    setStepError(null)
    setSubmitError(null)
    setIdempotencyKey(crypto.randomUUID())
  }

  const mileage = Number(formData.mileage)
  const payoff = Number(formData.payoffAmount)
  const vehicleRows: StickerRowData[] = [
    { label: 'Vehículo', value: [formData.year, formData.make, formData.model, formData.trim].filter(Boolean).join(' '), strong: true },
    { label: 'Kilometraje', value: formData.mileage && Number.isFinite(mileage) ? formatMileage(mileage) : null },
    { label: 'Patente', value: formData.licensePlate ? formData.licensePlate.toUpperCase() : null },
    ...(formData.engineNumber ? [{ label: 'Motor n.º', value: formData.engineNumber.toUpperCase() }] : []),
    ...(formData.vin ? [{ label: 'Chasis', value: formData.vin }] : []),
    { label: 'Estado', value: optionLabel(CONDITIONS, formData.condition) },
    { label: 'Titularidad', value: optionLabel(OWNERSHIP, formData.ownership) },
    ...(formData.ownership === 'financing' && formData.payoffAmount && Number.isFinite(payoff)
      ? [{ label: 'Saldo del crédito', value: formatPrice(payoff, business.currencyCode) }]
      : []),
    ...(photos.length ? [{ label: 'Fotos', value: String(photos.length) }] : []),
  ]
  const contactName = [formData.firstName, formData.lastName].filter(Boolean).join(' ')

  const sticker = (rows: StickerRowData[], meta?: string) => (
    <Sticker title="Véndelo en Elvis" meta={meta} rows={rows}>
      {interestedVehicle && <StickerVehicle vehicle={interestedVehicle} label="Para cambiar por" />}
    </Sticker>
  )

  if (submitted) {
    return (
      <RequestReceived
        context="Véndelo en Elvis"
        reference={submissionReference}
        note={`Un asesor revisa los datos${photos.length ? ' y las fotos' : ''} y te contacta para coordinar la tasación presencial. No es una oferta automática: el valor final surge de la revisión del vehículo en el salón.${photos.length && uploadedPhotos < photos.length ? ` Se subieron ${uploadedPhotos} de ${photos.length} fotos; puedes mandar las que faltan por WhatsApp.` : ''}`}
        summary={sticker([
          ...vehicleRows,
          { label: 'Nombre', value: contactName },
          { label: 'Email', value: formData.email },
          { label: 'Teléfono', value: formData.phone },
        ], business.shortName || business.fullName)}
        actions={
          <>
            <Link href="/inventory" className="sf-btn sf-btn-primary">Ver inventario</Link>
            <WhatsAppButton label="Enviar más fotos por WhatsApp" message={`Hola ${business.shortName}, envío fotos de mi ${[formData.make, formData.model, formData.year].filter(Boolean).join(' ')}${submissionReference ? ` (referencia ${submissionReference})` : ''}.`} className="sf-btn sf-btn-ghost" />
            <button type="button" onClick={reset} className="sf-btn sf-btn-ghost">Cotizar otro auto</button>
          </>
        }
      />
    )
  }

  const summary = sticker(
    step === 3 ? [...vehicleRows, { label: 'Name', value: contactName }] : vehicleRows,
    `Paso ${step}/3`,
  )

  return (
    <>
      <PageHeader title="Véndelo en Elvis" />

      <RequestLayout summary={summary}>
        <ol className="sf-track mb-[var(--sf-space-lg)]" aria-label="Pasos">
          {STEPS.map((label, i) => {
            const n = i + 1
            return (
              <li
                key={label}
                className="sf-pill cursor-default"
                data-active={step === n ? 'true' : undefined}
                aria-current={step === n ? 'step' : undefined}
                style={step > n ? { color: 'var(--sf-ink)' } : undefined}
              >
                <span className="sf-figure hidden opacity-70 sm:inline">{n}</span>
                {label}
              </li>
            )
          })}
        </ol>

        <p className="sf-muted mb-[var(--sf-space-md)] text-[length:var(--sf-text-sm)]">{ELVIS_INFO.planCanje} Las fotos sirven para una primera revisión.</p>
        <form onSubmit={handleFormSubmit} className="space-y-[var(--sf-space-lg)]">
          <input
            type="text"
            name="website"
            value={formData.website}
            onChange={(e) => setFormData((p) => ({ ...p, website: e.target.value }))}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />

          {step === 1 && (
            <FormSection title="Tu vehículo" first>
              <div className="grid gap-4">
                <Field label="Año" htmlFor="trade-year">
                  <ComboField id="trade-year" name="year" required inputMode="numeric" maxLength={4} allowCustom={false} emptyText="Elige un año de la lista" value={formData.year} onChange={(v) => setFormData((p) => ({ ...p, year: v }))} placeholder="Elige o escribe el año" options={YEARS.map(String)} />
                </Field>
                <Field label="Marca" htmlFor="trade-make">
                  <ComboField id="trade-make" name="make" required value={formData.make} onChange={(v) => setFormData((p) => (v === p.make ? p : { ...p, make: v, model: '', trim: '' }))} placeholder="Elige o escribe la marca" options={catalogMakes()} />
                </Field>
                <Field label="Modelo" htmlFor="trade-model">
                  <ComboField id="trade-model" name="model" required value={formData.model} onChange={(v) => setFormData((p) => (v === p.model ? p : { ...p, model: v, trim: '' }))} placeholder={formData.make ? 'Elige o escribe el modelo' : 'Primero elige la marca'} options={catalogModels(formData.make)} emptyText="Escribe el modelo" />
                </Field>
                <Field label="Versión" htmlFor="trade-trim" optional>
                  <ComboField id="trade-trim" name="trim" value={formData.trim} onChange={(v) => setFormData((p) => ({ ...p, trim: v }))} placeholder={formData.model ? 'Elige o escribe la versión' : 'Primero elige el modelo'} options={catalogVersions(formData.make, formData.model)} emptyText="Escribe la versión" />
                </Field>
                <Field label="Kilometraje" htmlFor="trade-mileage">
                  <input id="trade-mileage" type="number" inputMode="numeric" required min="0" max="2000000" step="1" value={formData.mileage} onChange={(e) => setFormData((p) => ({ ...p, mileage: e.target.value }))} className="sf-input sf-figure" placeholder="Ej.: 85000" />
                </Field>
                <Field label="Patente" htmlFor="trade-plate">
                  <input id="trade-plate" type="text" required value={formData.licensePlate} onChange={(e) => setFormData((p) => ({ ...p, licensePlate: e.target.value.toUpperCase() }))} className="sf-input sf-figure uppercase" placeholder="Ej.: AB123CD o ABC123" maxLength={9} autoCapitalize="characters" autoComplete="off" spellCheck={false} pattern="\s*[A-Za-z]{2}\s?-?\d{3}\s?-?[A-Za-z]{2}\s*|\s*[A-Za-z]{3}\s?-?\d{3}\s*" title="Formato AB123CD o ABC123" />
                </Field>
                <Field label="Número de motor" htmlFor="trade-engine" optional>
                  <input id="trade-engine" type="text" value={formData.engineNumber} onChange={(e) => setFormData((p) => ({ ...p, engineNumber: e.target.value.toUpperCase() }))} className="sf-input sf-figure uppercase" placeholder="Figura en la cédula verde" maxLength={30} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
                </Field>
                <Field label="Número de chasis (VIN)" htmlFor="trade-vin" optional>
                  <input id="trade-vin" type="text" value={formData.vin} onChange={(e) => setFormData((p) => ({ ...p, vin: e.target.value }))} className="sf-input sf-figure" placeholder="17 caracteres" maxLength={17} autoCapitalize="characters" spellCheck={false} />
                </Field>
              </div>
            </FormSection>
          )}

          {step === 2 && (
            <FormSection title="Estado y fotos" first>
              <div className="space-y-5">
                <RadioPills
                  legend="Estado general"
                  name="condition"
                  required
                  variant="grid"
                  className="grid-cols-2 sm:grid-cols-4"
                  value={formData.condition}
                  onChange={(e) => setFormData((p) => ({ ...p, condition: e.target.value }))}
                  options={CONDITIONS}
                />
                <RadioPills
                  legend="Titularidad"
                  name="ownership"
                  required
                  variant="grid"
                  className="grid-cols-3"
                  value={formData.ownership}
                  onChange={(e) => setFormData((p) => ({ ...p, ownership: e.target.value }))}
                  options={OWNERSHIP}
                />
                {formData.ownership === 'financing' && (
                  <Field label="Saldo aproximado del crédito" htmlFor="trade-payoff" className="sm:max-w-xs">
                    <div className="relative">
                      <span className="sf-figure sf-faint pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">{currencySymbol(business.currencyCode)}</span>
                      <input id="trade-payoff" type="number" inputMode="decimal" min="0" step="1" value={formData.payoffAmount} onChange={(e) => setFormData((p) => ({ ...p, payoffAmount: e.target.value }))} className="sf-input sf-figure pl-8" />
                    </div>
                  </Field>
                )}
                <Field label="Información adicional" htmlFor="trade-notes" optional>
                  <textarea id="trade-notes" rows={3} maxLength={2000} value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} className="sf-input resize-y" placeholder="Service al día, detalles de chapa, neumáticos, único dueño…" />
                </Field>
                <div>
                  <p className="sf-label">Fotos <span className="sf-faint">/ Opcional, hasta {MAX_PHOTOS}</span></p>
                  <p className="sf-muted mb-3 text-[length:var(--sf-text-sm)]">Frente, laterales, interior, tablero con el kilometraje y cualquier detalle. Se achican automáticamente antes de enviarse.</p>
                  {photos.length > 0 && (
                    <ul className="mb-3 grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label="Fotos elegidas">
                      {photos.map((photo, index) => (
                        <li key={photo.id} className="relative aspect-square overflow-hidden rounded-[var(--sf-radius-sm)] border" style={{ borderColor: 'var(--sf-rule)' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.url} alt={`Foto ${index + 1}`} className="size-full object-cover" />
                          <button type="button" onClick={() => { URL.revokeObjectURL(photo.url); setPhotos((current) => current.filter((item) => item.id !== photo.id)) }} className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/75 text-white" aria-label={`Quitar foto ${index + 1}`}>×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {photos.length < MAX_PHOTOS && (
                    <label className="sf-btn sf-btn-ghost cursor-pointer">
                      Agregar fotos
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="sr-only"
                        onChange={(event) => {
                          const files = Array.from(event.target.files || [])
                          event.target.value = ''
                          const valid = files.filter((file) => /^image\/(jpeg|png|webp)$/.test(file.type))
                          const room = MAX_PHOTOS - photos.length
                          setPhotoNotice(valid.length < files.length ? 'Algunos archivos no son fotos JPG, PNG o WebP y no se agregaron.' : valid.length > room ? `Puedes agregar hasta ${MAX_PHOTOS} fotos.` : null)
                          setPhotos((current) => [...current, ...valid.slice(0, room).map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))])
                        }}
                      />
                    </label>
                  )}
                  {photoNotice && <p className="sf-error mt-2">{photoNotice}</p>}
                </div>
              </div>
            </FormSection>
          )}

          {step === 3 && (
            <FormSection title="Tus datos" first>
              <div className="grid gap-4">
                <Field label="Nombre" htmlFor="trade-first-name">
                  <input id="trade-first-name" type="text" required autoComplete="given-name" value={formData.firstName} onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))} className="sf-input" />
                </Field>
                <Field label="Apellido" htmlFor="trade-last-name">
                  <input id="trade-last-name" type="text" required autoComplete="family-name" value={formData.lastName} onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))} className="sf-input" />
                </Field>
                <Field label="Email" htmlFor="trade-email">
                  <input id="trade-email" type="email" required autoComplete="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} className="sf-input" />
                </Field>
                <Field label="Teléfono" htmlFor="trade-phone">
                  <input id="trade-phone" type="tel" required autoComplete="tel" value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} className="sf-input" />
                </Field>
              </div>
            </FormSection>
          )}

          <div className="space-y-4">
            {step === 3 && <MobileSummary>{summary}</MobileSummary>}

            {stepError && <Notice tone="bad">{stepError}</Notice>}
            {step === 3 && submitError && <Notice tone="bad">{submitError}</Notice>}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
              {step > 1 && (
                <button type="button" onClick={() => goBack(step === 3 ? 2 : 1)} className="sf-btn sf-btn-ghost w-full sm:w-auto">
                  Volver
                </button>
              )}
              <button type="submit" disabled={step === 3 && isSubmitting} className="sf-btn sf-btn-primary w-full sm:w-auto sm:min-w-56">
                {step === 3 ? (isSubmitting ? (photoProgress || 'Enviando…') : 'Enviar para cotizar') : 'Continuar'}
              </button>
            </div>
          </div>
        </form>
      </RequestLayout>
    </>
  )
}
