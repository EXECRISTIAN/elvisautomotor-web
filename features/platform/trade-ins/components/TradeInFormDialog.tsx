'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Notice, Pill, Track } from '@/features/platform/components/desk'
import type { TradeInLeadOption, TradeInRooftop } from '../actions'
import { CONDITION_OPTIONS, VIN_PATTERN } from '../lib/tradeInState'

export type TradeInFormValues = {
  rooftopId: string
  leadId: string
  vin: string
  year: string
  make: string
  model: string
  trim: string
  mileage: string
  condition: string
  exteriorCondition: string
  interiorCondition: string
  mechanicalIssues: string
}

export const EMPTY_TRADE_IN_FORM: TradeInFormValues = {
  rooftopId: '', leadId: '', vin: '', year: '', make: '', model: '', trim: '', mileage: '', condition: '',
  exteriorCondition: '', interiorCondition: '', mechanicalIssues: '',
}

const NO_LEAD = 'none'
const fieldLabel = 'text-[12px] font-medium text-muted-foreground'

export function validateTradeInForm(values: TradeInFormValues, mode: 'create' | 'edit', leadRequired: boolean) {
  const errors: Partial<Record<keyof TradeInFormValues, string>> = {}
  if (mode === 'create' && !values.rooftopId) errors.rooftopId = 'Select a rooftop'
  if (mode === 'create' && leadRequired && !values.leadId) errors.leadId = 'Select the customer lead'
  const vin = values.vin.trim().toUpperCase()
  if (vin && !VIN_PATTERN.test(vin)) errors.vin = '17 letters and numbers, no I, O or Q'
  const year = Number(values.year)
  if (!/^\d{4}$/.test(values.year.trim()) || year < 1900 || year > new Date().getFullYear() + 2) errors.year = 'Ingresa un año de 4 dígitos'
  if (!values.make.trim()) errors.make = 'La marca es obligatoria'
  if (!values.model.trim()) errors.model = 'El modelo es obligatorio'
  const mileage = values.mileage.trim().replace(/,/g, '')
  if (mileage && (!/^\d+$/.test(mileage) || Number(mileage) > 2_000_000)) errors.mileage = 'Ingresa kilómetros enteros'
  return errors
}

/** Form values as the TradeIn vehicle and condition fields. */
export function tradeInDetailsPayload(values: TradeInFormValues) {
  const mileage = values.mileage.trim().replace(/,/g, '')
  return {
    vin: values.vin.trim().toUpperCase(),
    year: values.year.trim(),
    make: values.make.trim(),
    model: values.model.trim(),
    trim: values.trim.trim(),
    mileage: mileage ? Number(mileage) : null,
    condition: values.condition || null,
    exteriorCondition: values.exteriorCondition.trim(),
    interiorCondition: values.interiorCondition.trim(),
    mechanicalIssues: values.mechanicalIssues.trim(),
  }
}

function Field({ label, error, htmlFor, children, wide }: { label: string; error?: string; htmlFor: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`grid min-w-0 gap-1.5 text-sm ${wide ? 'sm:col-span-2' : ''}`}>
      <label htmlFor={htmlFor} className={fieldLabel}>{label}</label>
      {children}
      {error && <p id={`${htmlFor}-error`} className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

export function TradeInFormDialog({
  open,
  mode,
  initialValues,
  rooftops = [],
  leads = [],
  leadRequired = false,
  busy,
  error,
  onSubmit,
  onOpenChange,
}: {
  open: boolean
  mode: 'create' | 'edit'
  initialValues: TradeInFormValues
  rooftops?: TradeInRooftop[]
  leads?: TradeInLeadOption[]
  leadRequired?: boolean
  busy: boolean
  error: string | null
  onSubmit: (values: TradeInFormValues) => void
  onOpenChange: (open: boolean) => void
}) {
  const [values, setValues] = useState<TradeInFormValues>(initialValues)
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (open) {
      setValues(initialValues)
      setShowErrors(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const errors = validateTradeInForm(values, mode, leadRequired)
  const shown = showErrors ? errors : {}
  const set = (name: keyof TradeInFormValues, value: string) => setValues(current => ({ ...current, [name]: value }))
  const rooftopLeads = leads.filter(lead => !values.rooftopId || lead.rooftop?.id === values.rooftopId)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setShowErrors(true)
    if (Object.keys(errors).length) return
    onSubmit(values)
  }

  const input = (name: keyof TradeInFormValues, props: Record<string, unknown> = {}) => (
    <Input
      id={`trade-in-${name}`}
      value={values[name]}
      onChange={event => set(name, event.target.value)}
      aria-invalid={shown[name] ? true : undefined}
      aria-describedby={shown[name] ? `trade-in-${name}-error` : undefined}
      {...props}
      className={['rounded-[4px]', typeof props.className === 'string' ? props.className : ''].join(' ').trim()}
    />
  )

  return (
    <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value) }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nuevo usado ofrecido' : 'Editar usado ofrecido'}</DialogTitle>
          <DialogDescription>{mode === 'create' ? 'Tasación en el salón o por teléfono' : 'Vehículo y estado'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {mode === 'create' && (
              <>
                <Field label="Sucursal" htmlFor="trade-in-rooftopId" error={shown.rooftopId}>
                  <Select value={values.rooftopId} onValueChange={value => setValues(current => ({ ...current, rooftopId: value, leadId: '' }))}>
                    <SelectTrigger className="rounded-[4px]" id="trade-in-rooftopId" aria-invalid={shown.rooftopId ? true : undefined}><SelectValue placeholder="Elige la sucursal" /></SelectTrigger>
                    <SelectContent>{rooftops.map(rooftop => <SelectItem key={rooftop.id} value={rooftop.id}>{rooftop.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label={leadRequired ? 'Consulta del cliente' : 'Consulta del cliente (opcional)'} htmlFor="trade-in-leadId" error={shown.leadId}>
                  <Select value={values.leadId || (leadRequired ? '' : NO_LEAD)} onValueChange={value => set('leadId', value === NO_LEAD ? '' : value)} disabled={!values.rooftopId}>
                    <SelectTrigger className="rounded-[4px]" id="trade-in-leadId" aria-invalid={shown.leadId ? true : undefined}><SelectValue placeholder={values.rooftopId ? 'Elige la consulta' : 'Primero elige la sucursal'} /></SelectTrigger>
                    <SelectContent>
                      {!leadRequired && <SelectItem value={NO_LEAD}>Sin consulta</SelectItem>}
                      {rooftopLeads.map(lead => (
                        <SelectItem key={lead.id} value={lead.id}>{[lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.email || 'Cliente'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}
            <Field label="VIN / chasis" htmlFor="trade-in-vin" error={shown.vin} wide>
              {input('vin', { maxLength: 17, autoComplete: 'off', className: 'font-mono uppercase', placeholder: 'Opcional hasta el ingreso' })}
            </Field>
            <Field label="Año" htmlFor="trade-in-year" error={shown.year}>{input('year', { inputMode: 'numeric', maxLength: 4 })}</Field>
            <Field label="Marca" htmlFor="trade-in-make" error={shown.make}>{input('make', { maxLength: 100 })}</Field>
            <Field label="Modelo" htmlFor="trade-in-model" error={shown.model}>{input('model', { maxLength: 100 })}</Field>
            <Field label="Versión" htmlFor="trade-in-trim">{input('trim', { maxLength: 100 })}</Field>
            <Field label="Kilometraje" htmlFor="trade-in-mileage" error={shown.mileage}>{input('mileage', { inputMode: 'numeric' })}</Field>
            <Field label="Estado" htmlFor="trade-in-condition">
              <Select value={values.condition} onValueChange={value => set('condition', value)}>
                <SelectTrigger className="rounded-[4px]" id="trade-in-condition"><SelectValue placeholder="Elige el estado" /></SelectTrigger>
                <SelectContent>{CONDITION_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            {(['exteriorCondition', 'interiorCondition', 'mechanicalIssues'] as const).map(name => (
              <Field key={name} wide htmlFor={`trade-in-${name}`} label={name === 'exteriorCondition' ? 'Exterior notes' : name === 'interiorCondition' ? 'Notas del interior' : 'Problemas mecánicos'}>
                <Textarea className="rounded-[4px]" id={`trade-in-${name}`} rows={2} maxLength={2000} value={values[name]} onChange={event => set(name, event.target.value)} />
              </Field>
            ))}
          </div>
          {error && <Notice tone="bad">{error}</Notice>}
          <DialogFooter className="sm:justify-end">
            <Track>
              <Pill variant="plain" disabled={busy} onClick={() => onOpenChange(false)}>Cancelar</Pill>
              <Pill type="submit" variant="primary" disabled={busy}>{busy ? 'Guardando…' : mode === 'create' ? 'Crear usado ofrecido' : 'Guardar'}</Pill>
            </Track>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
