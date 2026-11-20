'use client'

import { PlatformDateInput } from '@/features/platform/components/PlatformDateTime'
import { PlatformSelect } from '@/features/platform/components/PlatformSelect'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { fetchGraphQL } from '@/features/storefront/lib/data/public-read'
import { GET_VEHICLE_BY_ID } from '@/features/storefront/lib/data/queries'
import type { Vehicle } from '@/features/storefront/lib/types'
import { submitStorefrontTestDrive } from '../lib/submit'
import { PageHeader } from '../components/PageHeader'
import { useStorefrontBusiness } from '../components/StorefrontBusinessProvider'
import { customerRequestReference } from '../lib/customerRequests'
import { fillBlankFields, useCustomerPrefill } from '../lib/useCustomerPrefill'
import { fetchListedInventoryOptions, type InventoryOption } from '../lib/data/inventory-facets'
import { formatPrice } from '../lib/format'
import { DEFAULT_TEST_DRIVE_SLOTS, closedDayLabel, dayAvailability, localDateString, displaySlot } from '../lib/bookingSlots'
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
  formatRequestDate,
} from '../components/forms/RequestForm'

type TestDriveSummary = { name: string; email: string; phone: string; date: string; time: string }

export function TestDrivePage() {
  const business = useStorefrontBusiness()
  const searchParams = useSearchParams()
  const vehicleId = searchParams?.get('vehicleId')

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    preferredDate: '',
    preferredTime: '',
    vehicleId: vehicleId || '',
    message: '',
    website: '',
  })
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [requestReference, setRequestReference] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [submittedVehicle, setSubmittedVehicle] = useState<Vehicle | null>(null)
  const [submittedSummary, setSubmittedSummary] = useState<TestDriveSummary | null>(null)
  const [inventoryOptions, setInventoryOptions] = useState<InventoryOption[] | null>(null)
  const [inventoryError, setInventoryError] = useState(false)
  const prefill = useCustomerPrefill()

  useEffect(() => {
    if (!prefill) return
    setFormData((prev) => fillBlankFields(prev, { customerName: prefill.name, customerEmail: prefill.email, customerPhone: prefill.phone }))
  }, [prefill])

  useEffect(() => {
    let active = true
    void fetchListedInventoryOptions()
      .then((items) => { if (active) setInventoryOptions(items) })
      .catch(() => { if (active) { setInventoryOptions([]); setInventoryError(true) } })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (vehicleId) setFormData((prev) => ({ ...prev, vehicleId }))
  }, [vehicleId])

  useEffect(() => {
    const id = formData.vehicleId
    if (!id) {
      setSelectedVehicle(null)
      return
    }
    let active = true
    void fetchGraphQL<{ publicInventoryVehicle: Vehicle | null }>(GET_VEHICLE_BY_ID, { id })
      .then((data) => { if (active) setSelectedVehicle(data.publicInventoryVehicle ?? null) })
      .catch(() => { if (active) setSelectedVehicle(null) })
    return () => { active = false }
  }, [formData.vehicleId])

  const optionLabel = (item: InventoryOption) => [
    [item.year, item.make, item.model, item.trim].filter(Boolean).join(' '),
    item.stockNumber ? `Stock ${item.stockNumber}` : null,
    item.price ? formatPrice(item.price, business.currencyCode) : null,
  ].filter(Boolean).join(' · ')
  const pickerOptions = inventoryOptions ?? []
  const missingSelected = formData.vehicleId && !pickerOptions.some((item) => item.id === formData.vehicleId)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value, ...(name === 'preferredDate' ? { preferredTime: '' } : {}) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')
    setSubmitError(null)
    try {
      const result = await submitStorefrontTestDrive({
        ...formData,
        rooftopSlug: business.rooftopSlug,
        idempotencyKey,
      })
      if (!result.success) throw new Error(result.error)
      setSubmittedSummary({
        name: formData.customerName,
        email: formData.customerEmail,
        phone: formData.customerPhone,
        date: formData.preferredDate,
        time: formData.preferredTime,
      })
      setSubmittedVehicle(selectedVehicle)
      setRequestReference(customerRequestReference('test-drive', result.data.testDriveId))
      setSubmitStatus('success')
      setIdempotencyKey(crypto.randomUUID())
      setFormData({
        customerName: prefill?.name || '',
        customerEmail: prefill?.email || '',
        customerPhone: prefill?.phone || '',
        preferredDate: '',
        preferredTime: '',
        vehicleId: '',
        message: '',
        website: '',
      })
    } catch (error) {
      setSubmitError(error instanceof Error && error.message ? error.message : null)
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const minDate = localDateString(new Date(), business.timezone)
  const availability = dayAvailability(business, formData.preferredDate, DEFAULT_TEST_DRIVE_SLOTS)

  if (submitStatus === 'success') {
    return (
      <RequestReceived
        context="Prueba de manejo"
        reference={requestReference}
        summary={
          <Sticker
            title="Prueba de manejo"
            meta={business.shortName || business.fullName}
            rows={[
              { label: 'Fecha', value: submittedSummary ? formatRequestDate(submittedSummary.date) : null },
              { label: 'Hora', value: submittedSummary?.time ? displaySlot(submittedSummary.time) : null },
              { label: 'Nombre', value: submittedSummary?.name },
              { label: 'Email', value: submittedSummary?.email },
              { label: 'Teléfono', value: submittedSummary?.phone },
            ]}
          >
            {submittedVehicle && <StickerVehicle vehicle={submittedVehicle} label="Vehículo" />}
          </Sticker>
        }
        actions={
          <>
            <Link
              href={submittedVehicle ? `/inventory/${submittedVehicle.id}` : '/inventory'}
              className="sf-btn sf-btn-primary"
            >
              {submittedVehicle ? 'Volver al vehículo' : 'Ver inventario'}
            </Link>
            <Link href="/financing" className="sf-btn sf-btn-ghost">Financiación</Link>
            <Link href="/trade-in" className="sf-btn sf-btn-ghost">Usado</Link>
          </>
        }
      />
    )
  }

  const summary = (
    <Sticker
      title="Prueba de manejo"
      meta={business.shortName || business.fullName}
      rows={[
        { label: 'Fecha', value: formData.preferredDate ? formatRequestDate(formData.preferredDate) : null },
        { label: 'Hora', value: formData.preferredTime ? displaySlot(formData.preferredTime) : null, strong: true },
        { label: 'Nombre', value: formData.customerName },
      ]}
    >
      {selectedVehicle ? (
        <StickerVehicle vehicle={selectedVehicle} label="Vehículo" />
      ) : (
        <div className="flex items-center justify-between gap-3 border-b border-dashed px-4 py-3" style={{ borderColor: 'var(--sf-rule)' }}>
          <span className="sf-eyebrow">Vehículo</span>
          <Link href="/inventory" className="sf-link text-[length:var(--sf-text-sm)]">Elige del inventario</Link>
        </div>
      )}
    </Sticker>
  )

  return (
    <>
      <PageHeader title="Coordina una prueba de manejo" />

      <RequestLayout summary={summary}>
        <form onSubmit={handleSubmit} className="space-y-[var(--sf-space-xl)]">
          <FormSection title="Fecha y hora" first>
            <div className="space-y-5">
              <Field label="Fecha" htmlFor="preferredDate" className="sm:max-w-xs">
                <PlatformDateInput
                  id="preferredDate"
                  isDateDisabled={(key) => { const day = dayAvailability(business, key, DEFAULT_TEST_DRIVE_SLOTS); return day.status === 'closed' && day.reason === 'closed' }}
                  name="preferredDate"
                  required
                  min={minDate}
                  value={formData.preferredDate}
                  onChange={(value) => setFormData((prev) => ({ ...prev, preferredDate: value, preferredTime: '' }))}
                  className="sf-input sf-trigger"
                />
              </Field>

              {availability.status === 'closed' ? (
                <div className="sf-well p-4">
                  <p role="alert" className="sf-title-line text-[length:var(--sf-text-sm)]">
                    <span className="sf-dot" data-tone="bad" aria-hidden="true" />
                    <span>{closedDayLabel(availability)} Elige otra fecha.</span>
                  </p>
                </div>
              ) : (
                <RadioPills
                  legend="Hora"
                  name="preferredTime"
                  required
                  variant="grid"
                  className="grid-cols-3 sm:grid-cols-4 xl:grid-cols-5"
                  value={formData.preferredTime}
                  onChange={handleChange}
                  options={availability.slots.map((slot) => ({
                    value: slot,
                    label: <span className="sf-figure">{displaySlot(slot)}</span>,
                  }))}
                />
              )}
            </div>
          </FormSection>

          <FormSection title="Vehículo">
            <Field label="Vehículo" htmlFor="vehicleId" optional>
              <PlatformSelect
                id="vehicleId"
                name="vehicleId"
                value={formData.vehicleId}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, vehicleId: value }))}
                className="sf-input sf-trigger"
                placeholder={inventoryOptions === null ? 'Cargando inventario' : 'Ninguno en particular'}
                options={[
                  { value: '', label: inventoryOptions === null ? 'Cargando inventario' : 'Ninguno en particular' },
                  ...(missingSelected && selectedVehicle
                    ? [{ value: formData.vehicleId, label: [selectedVehicle.year, selectedVehicle.make, selectedVehicle.model, selectedVehicle.trim].filter(Boolean).join(' ') }]
                    : []),
                  ...pickerOptions.map((item) => ({ value: item.id, label: optionLabel(item) })),
                ]}
              />
            </Field>
            {inventoryError && (
              <p className="sf-muted mt-2 text-[length:var(--sf-text-sm)]" role="status">Inventario no disponible.</p>
            )}
          </FormSection>

          <FormSection title="Contacto">
            <div className="grid gap-4">
              <Field label="Nombre completo" htmlFor="customerName">
                <input
                  id="customerName"
                  name="customerName"
                  type="text"
                  required
                  autoComplete="name"
                  value={formData.customerName}
                  onChange={handleChange}
                  className="sf-input"
                />
              </Field>
              <Field label="Email" htmlFor="customerEmail">
                <input
                  id="customerEmail"
                  name="customerEmail"
                  type="email"
                  required
                  autoComplete="email"
                  value={formData.customerEmail}
                  onChange={handleChange}
                  className="sf-input"
                />
              </Field>
              <Field label="Teléfono" htmlFor="customerPhone">
                <input
                  id="customerPhone"
                  name="customerPhone"
                  type="tel"
                  required
                  autoComplete="tel"
                  value={formData.customerPhone}
                  onChange={handleChange}
                  className="sf-input"
                />
              </Field>
              <Field label="Notas" htmlFor="message" optional>
                <textarea
                  id="message"
                  name="message"
                  rows={3}
                  value={formData.message}
                  onChange={handleChange}
                  className="sf-input"
                  placeholder="Vehículo de interés"
                />
              </Field>
            </div>
          </FormSection>

          <input
            type="text"
            name="website"
            value={formData.website}
            onChange={handleChange}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />

          <div className="space-y-4">
            <MobileSummary>{summary}</MobileSummary>

            {submitStatus === 'error' && (
              <Notice tone="bad">
                {submitError || 'We couldn’t send your request.'}{' '}
                {business.phoneHref && business.phoneDisplay ? (
                  <>
                    Llamar <a href={business.phoneHref} className="sf-link sf-figure">{business.phoneDisplay}</a> to schedule directly.
                  </>
                ) : business.salesEmail ? (
                  <>Intenta de nuevo o escríbenos a <a href={`mailto:${business.salesEmail}`} className="sf-link break-all">{business.salesEmail}</a>.</>
                ) : (
                  <>Intenta de nuevo más tarde.</>
                )}
              </Notice>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={isSubmitting || availability.status === 'closed'}
                className="sf-btn sf-btn-primary w-full sm:w-auto sm:min-w-56"
              >
                {isSubmitting ? 'Enviando…' : 'Solicitar prueba de manejo'}
              </button>
              <Link href="/inventory" className="sf-btn sf-btn-ghost w-full sm:w-auto">
                Cancel
              </Link>
            </div>
          </div>
        </form>
      </RequestLayout>
    </>
  )
}
