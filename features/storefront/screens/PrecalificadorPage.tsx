'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, MapPin } from 'lucide-react'
import { Container } from '../components/Container'
import { ComboField } from '../components/ComboField'
import { WhatsAppChannelButton } from '../components/WhatsAppChannelButton'
import { useStorefrontBusiness } from '../components/StorefrontBusinessProvider'
import { submitStorefrontPrecalification } from '../lib/submit'
import { catalogMakes, POPULAR_MAKES, catalogModels } from '@/features/lib/vehicleCatalog'

type Answers = Record<string, string>
type Choice = { id: string; title: string; subtitle?: string; options: string[]; when?: (a: Answers) => boolean }

const LOOKING = '¿Qué estás buscando?'
const PAY = '¿Cómo piensas comprar tu 0 km?'
const TRADE = '¿Tienes un vehículo para entregar?'
const FINANCE = 'Quiero financiar'
const HAS_TRADE = 'Sí, tengo permuta'

const financing = (a: Answers) => a.pay === FINANCE
const hasTrade = (a: Answers) => a.trade === HAS_TRADE

const CHOICES: Choice[] = [
  { id: 'looking', title: LOOKING, subtitle: 'Elige una opción para orientarte mejor.', options: ['0 km', 'Usado'] },
  { id: 'pay', title: PAY, subtitle: 'Esto nos ayuda a definir el tipo de atención ideal.', options: [FINANCE, 'Quiero comprar de contado'] },
  { id: 'trade', title: TRADE, subtitle: 'Si tienes permuta, la tenemos en cuenta como parte de tu capacidad para iniciar la operación.', options: [HAS_TRADE, 'No, sin permuta'] },
  { id: 'tradeVehicle', title: 'Cuéntanos qué vehículo entregarías', subtitle: 'Es solo una referencia comercial. La cotización final se confirma viendo la unidad.', options: ['Menos de $10.000.000', '$10.000.000 a $20.000.000', 'Más de $20.000.000'], when: hasTrade },
  { id: 'tradePlan', title: '¿Cómo completarías la operación?', subtitle: 'Además de tu vehículo, ¿sumarías dinero?', options: ['Entregaría solo la permuta', 'La permuta + dinero'], when: hasTrade },
  { id: 'kind', title: '¿Qué tipo de 0 km buscas?', subtitle: 'Elige la opción que más se parece a lo que necesitas.', options: ['Mi primer 0 km / busco algo económico', 'Busco algo para trabajar en las aplicaciones', 'Busco un utilitario para mi oficio o trabajo', 'Otro'] },
  { id: 'installment', title: '¿Qué cuota mensual podrías pagar?', subtitle: 'Elige el rango que mejor represente tu capacidad mensual.', options: ['Menos de $1 millón por mes', '$1 a $2 millones por mes', 'Más de $2 millones por mes'], when: financing },
  { id: 'job', title: '¿Cuál es tu situación laboral?', subtitle: 'Elige la opción que mejor te represente.', options: ['Empleado en blanco', 'Empleado en negro', 'Autónomo en blanco', 'Autónomo en negro', 'Jubilado / Otro', 'Desempleado'], when: financing },
  { id: 'income', title: '¿Cuáles son los ingresos mensuales del hogar?', subtitle: 'Puedes sumar tus ingresos y los de tu cónyuge o pareja.', options: ['Menos de $2 millones por mes', '$2 a $5 millones por mes', 'Más de $5 millones por mes'], when: financing },
  { id: 'cards', title: '¿Cómo vienes usando tus tarjetas de crédito?', subtitle: 'Esto nos ayuda a entender mejor tu situación actual.', options: ['No uso tarjeta', 'Uso y pago al día', 'Tuve algún atraso y ya lo regularicé', 'Estoy atrasado actualmente'], when: financing },
  { id: 'loans', title: '¿Tuviste créditos o financiación de auto recientemente?', subtitle: 'Elige la opción más cercana.', options: ['Terminé de pagar un crédito hace menos de un año', 'Tengo un crédito y lo pago al día', 'Tuve créditos, pero hace tiempo', 'Nunca tuve créditos importantes', 'Tengo atrasos en créditos'], when: financing },
  { id: 'eligibility', title: '¿Cómo está hoy tu situación para pedir un crédito?', subtitle: 'Elige la opción que mejor represente tu caso.', options: ['Sé que estoy apto porque ya califiqué en otro lado', 'No estoy seguro / no averigüé en ningún lado', 'Ya sé que hoy no me aprueban / estoy en Veraz'], when: financing },
  { id: 'when', title: '¿Cuándo quieres resolver la compra?', subtitle: 'Esto nos ayuda a priorizar correctamente la atención.', options: ['Esta semana', 'Dentro de 30 días', 'En 1 a 3 meses', 'Solo estoy averiguando'] },
  { id: 'why', title: '¿Por qué quieres comprar tu 0 km en Elvis?', subtitle: 'Elige la opción que mejor te represente.', options: ['Porque ya soy cliente', 'Porque me mintieron en otro lado y quiero probar con Elvis', 'Porque busco el mejor precio', 'Para conocer a Elvis personalmente', 'Otro'] },
]

const PROVINCES = ['Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán']
const YEARS = Array.from({ length: new Date().getFullYear() + 2 - 1900 }, (_, i) => String(new Date().getFullYear() + 1 - i))

const onlyDigits = (value: string) => value.replace(/\D/g, '')
function formatCuil(value: string) {
  const d = onlyDigits(value).slice(0, 11)
  return d.length > 10 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : d.length > 2 ? `${d.slice(0, 2)}-${d.slice(2)}` : d
}

export function PrecalificadorPage() {
  const business = useStorefrontBusiness()
  const [phone, setPhone] = useState('')
  const [answers, setAnswers] = useState<Answers>({})
  const [tradeCar, setTradeCar] = useState({ make: '', model: '', year: '', link: '' })
  const [step, setStep] = useState(0) // 0 = teléfono; 1..n = preguntas; 'final' al final
  const [final, setFinal] = useState(false)
  const [form, setForm] = useState({ fullName: '', dni: '', cuil: '', locality: '', province: 'Buenos Aires', confirmPhone: '', message: '', times: [] as string[], consent: false })
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const idempotencyKey = useRef(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()))
  const top = useRef<HTMLDivElement>(null)

  const used = answers.looking === 'Usado'
  const flow = useMemo(() => CHOICES.filter((choice) => choice.id === 'looking' || (!used && (!choice.when || choice.when(answers)))), [answers, used])
  const total = used ? 3 : flow.length + 2
  const position = final ? total : step + 1
  const current = step >= 1 && !final && !(used && step === 2) ? flow[step - 1] : null

  const scrollTop = () => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const go = (next: number) => { setError(null); setStep(next); setFinal(false); scrollTop() }
  const toFinal = () => { setError(null); setFinal(true); setForm((f) => ({ ...f, confirmPhone: f.confirmPhone || phone })); scrollTop() }
  const back = () => {
    if (final) { setFinal(false); setStep(used ? 2 : flow.length); scrollTop(); return }
    if (step > 0) go(step - 1)
  }

  function choose(choice: Choice, option: string) {
    if (choice.id === 'tradeVehicle' && (!tradeCar.make.trim() || !tradeCar.model.trim() || !tradeCar.year)) {
      setError('Indica marca, modelo y año de tu vehículo.')
      return
    }
    const next = { ...answers, [choice.id]: option }
    setAnswers(next)
    if (choice.id === 'looking' && option === 'Usado') { go(2); return }
    const nextFlow = CHOICES.filter((c) => c.id === 'looking' || (!c.when || c.when(next)))
    const index = nextFlow.findIndex((c) => c.id === choice.id)
    if (index + 1 >= nextFlow.length) toFinal()
    else go(index + 2)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (onlyDigits(form.confirmPhone) !== onlyDigits(phone)) { setError('El número de WhatsApp no coincide con el que cargaste al principio. Revísalo.'); return }
    if (form.dni && !/^\d{7,8}$/.test(onlyDigits(form.dni))) { setError('El DNI debe tener 7 u 8 números.'); return }
    if (form.cuil && onlyDigits(form.cuil).length !== 11) { setError('El CUIL debe tener 11 números.'); return }
    if (!form.consent) { setError('Necesitamos tu autorización para contactarte.'); return }
    const list = (used ? CHOICES.slice(0, 1) : flow).filter((c) => answers[c.id]).map((c) => ({ question: c.title, answer: c.id === 'tradeVehicle' ? `${tradeCar.make} ${tradeCar.model} ${tradeCar.year} · ${answers[c.id]}${tradeCar.link.trim() ? ` · ${tradeCar.link.trim()}` : ''}` : answers[c.id] }))
    setSending(true)
    try {
      const result = await submitStorefrontPrecalification({
        fullName: form.fullName.trim(), phone: onlyDigits(phone), dni: onlyDigits(form.dni), cuil: onlyDigits(form.cuil),
        locality: form.locality.trim(), province: form.province.trim(), message: form.message.trim(), answers: list,
        contactTimes: form.times, consent: form.consent, rooftopSlug: business.rooftopSlug, idempotencyKey: idempotencyKey.current,
      })
      if (!result.success) throw new Error(result.error)
      setDone(true)
      scrollTop()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos enviar tu consulta. Intenta de nuevo.')
    } finally {
      setSending(false)
    }
  }

  const card = 'elv-pq-card'
  return (
    <section className="py-8 md:py-14">
      <Container className="max-w-xl">
        <div ref={top} className="scroll-mt-24">
          <div className="flex items-center justify-between gap-4">
            <p className="sf-display text-[1.35rem]">Precalificador <span className="sf-gold-text">Elvis</span></p>
            {!done && <p className="sf-muted text-[0.9rem]">Paso {Math.min(position, total)} de {total}</p>}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--sf-rule)' }} role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={done ? total : position} aria-label="Avance">
            <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${done ? 100 : Math.max(6, (position / total) * 100)}%`, background: 'var(--sf-gold-gradient)' }} />
          </div>
        </div>

        <div className="elv-pq-panel mt-6">
          {done ? (
            <div role="status">
              <span className="grid size-12 place-items-center rounded-full" style={{ background: 'var(--sf-gold-gradient)', color: 'var(--sf-accent-ink)' }}><Check className="size-6" aria-hidden="true" /></span>
              <h1 className="sf-display mt-4 text-[1.6rem]">¡Listo! Recibimos tu consulta</h1>
              <p className="sf-muted mt-2">Un vendedor revisa tu caso y te escribe por WhatsApp{form.times.length ? ` ${form.times.map((t) => (t === 'morning' ? 'por la mañana' : 'por la tarde')).join(' o ')}` : ''}. Recibimos muchas consultas: la respuesta puede demorar.</p>
              <div className="mt-6 grid gap-3"><WhatsAppChannelButton /><Link href="/inventory" className="sf-btn sf-btn-outline min-h-12 rounded-[10px]">Ver el inventario</Link></div>
            </div>
          ) : step === 0 && !final ? (
            <form onSubmit={(e) => { e.preventDefault(); if (onlyDigits(phone).length < 10) { setError('Ingresa tu número completo con código de área, sin el 0 ni el 15. Ej.: 1123456789.'); return } go(1) }}>
              <h1 className="sf-display text-[1.6rem]">Antes de empezar</h1>
              <p className="sf-muted mt-1">Ingresa tu número de WhatsApp.</p>
              <label htmlFor="pq-phone" className="sf-label mt-6 block">Número de celular / WhatsApp</label>
              <input id="pq-phone" type="tel" inputMode="numeric" autoComplete="tel-national" required value={phone} onChange={(e) => setPhone(onlyDigits(e.target.value).slice(0, 13))} className="sf-input mt-2 w-full text-[1.1rem]" placeholder="Ej.: 1123456789" />
              <p className="elv-pq-note mt-4"><strong>Importante:</strong> carga bien el número: es al que te vamos a contactar.</p>
              {error && <p role="alert" className="mt-3 text-[0.9rem]" style={{ color: 'var(--sf-warn, #e0a23a)' }}>{error}</p>}
              <button type="submit" className="sf-btn sf-btn-primary mt-6 min-h-14 w-full rounded-[12px] text-[1rem]">Continuar</button>
            </form>
          ) : used && step === 2 && !final ? (
            <div>
              <h1 className="sf-display text-[1.6rem]">Usados</h1>
              <p className="elv-pq-note mt-4"><strong>Para usados no hace falta completar el precalificador.</strong> Mira los usados disponibles o síguenos en el canal de WhatsApp para enterarte de las oportunidades.</p>
              <div className="mt-6 grid gap-3">
                <Link href="/inventory?condition=used" className="sf-btn sf-btn-primary min-h-14 rounded-[12px]">Ver autos usados</Link>
                <WhatsAppChannelButton />
                {business.directionsHref && <a href={business.directionsHref} target="_blank" rel="noreferrer" className="sf-btn sf-btn-outline min-h-14 rounded-[12px]"><MapPin className="size-4" aria-hidden="true" />Cómo llegar a Elvis</a>}
                <button type="button" onClick={toFinal} className="sf-btn sf-btn-ghost min-h-12 rounded-[12px]">Prefiero que me contacten</button>
              </div>
            </div>
          ) : current ? (
            <div>
              <h1 className="sf-display text-[1.5rem] leading-tight">{current.title}</h1>
              {current.subtitle && <p className="sf-muted mt-2">{current.subtitle}</p>}
              {current.id === 'tradeVehicle' && (
                <div className="mt-5 grid gap-4">
                  <div><label htmlFor="pq-make" className="sf-label">Marca</label><div className="mt-2"><ComboField id="pq-make" value={tradeCar.make} onChange={(v) => setTradeCar((c) => (v === c.make ? c : { ...c, make: v, model: '' }))} options={catalogMakes(tradeCar.year)} popular={POPULAR_MAKES} allLabel="Todas las marcas" placeholder="Ej.: Chevrolet" /></div></div>
                  <div><label htmlFor="pq-model" className="sf-label">Modelo</label><div className="mt-2"><ComboField id="pq-model" value={tradeCar.model} onChange={(v) => setTradeCar((c) => ({ ...c, model: v }))} options={catalogModels(tradeCar.make, tradeCar.year)} placeholder="Ej.: Onix" emptyText="Escribe el modelo" /></div></div>
                  <div><label htmlFor="pq-year" className="sf-label">Año</label><div className="mt-2"><ComboField id="pq-year" value={tradeCar.year} onChange={(v) => setTradeCar((c) => ({ ...c, year: v }))} options={YEARS} inputMode="numeric" maxLength={4} allowCustom={false} placeholder="Ej.: 2018" /></div></div>
                  <div><label htmlFor="pq-link" className="sf-label">Link de la publicación <span className="sf-faint">(opcional)</span></label><input id="pq-link" type="url" inputMode="url" value={tradeCar.link} onChange={(e) => setTradeCar((c) => ({ ...c, link: e.target.value }))} className="sf-input mt-2 w-full" placeholder="MercadoLibre, Facebook, Drive con fotos…" autoComplete="off" spellCheck={false} /></div>
                  <p className="sf-label mt-2">Valor aproximado de tu permuta</p>
                </div>
              )}
              <div className="mt-5 grid gap-3" role="group" aria-label={current.title}>
                {current.options.map((option) => (
                  <button key={option} type="button" className={card} aria-pressed={answers[current.id] === option} onClick={() => choose(current, option)}>
                    {option}
                  </button>
                ))}
              </div>
              {error && <p role="alert" className="mt-3 text-[0.9rem]" style={{ color: 'var(--sf-warn, #e0a23a)' }}>{error}</p>}
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <h1 className="sf-display text-[1.6rem]">Último paso</h1>
              <p className="sf-muted mt-1">Déjanos tus datos para que podamos revisar tu caso.</p>
              <p id="pq-times" className="sf-label mt-6">¿En qué horario prefieres que te escribamos por WhatsApp?</p>
              <div className="mt-2 grid grid-cols-2 gap-3" role="group" aria-labelledby="pq-times">
                {[['morning', '🌅 Por la mañana'], ['afternoon', '🌇 Por la tarde']].map(([value, label]) => {
                  const on = form.times.includes(value)
                  return <button key={value} type="button" className={card} aria-pressed={on} onClick={() => setForm((f) => ({ ...f, times: on ? f.times.filter((t) => t !== value) : [...f.times, value] }))}>{label}</button>
                })}
              </div>
              <p className="sf-faint mt-1 text-[0.8rem]">Puedes elegir uno o los dos.</p>
              <div className="mt-6 grid gap-4">
                <div><label htmlFor="pq-name" className="sf-label">Nombre y apellido completo</label><input id="pq-name" required autoComplete="name" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} className="sf-input mt-2 w-full" placeholder="Nombre y apellido" /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label htmlFor="pq-dni" className="sf-label">DNI</label><input id="pq-dni" inputMode="numeric" value={form.dni} onChange={(e) => setForm((f) => ({ ...f, dni: onlyDigits(e.target.value).slice(0, 8) }))} className="sf-input mt-2 w-full" placeholder="Solo números" /></div>
                  <div><label htmlFor="pq-cuil" className="sf-label">CUIL</label><input id="pq-cuil" inputMode="numeric" value={form.cuil} onChange={(e) => setForm((f) => ({ ...f, cuil: formatCuil(e.target.value) }))} className="sf-input mt-2 w-full" placeholder="XX-XXXXXXXX-X" /></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label htmlFor="pq-locality" className="sf-label">Localidad</label><input id="pq-locality" autoComplete="address-level2" value={form.locality} onChange={(e) => setForm((f) => ({ ...f, locality: e.target.value }))} className="sf-input mt-2 w-full" placeholder="Ej.: Quilmes" /></div>
                  <div><label htmlFor="pq-province" className="sf-label">Provincia</label><div className="mt-2"><ComboField id="pq-province" value={form.province} onChange={(v) => setForm((f) => ({ ...f, province: v }))} options={PROVINCES} allowCustom={false} placeholder="Elige la provincia" /></div></div>
                </div>
                <div><label htmlFor="pq-confirm" className="sf-label">Confirma tu número de WhatsApp</label><input id="pq-confirm" type="tel" inputMode="numeric" required value={form.confirmPhone} onChange={(e) => setForm((f) => ({ ...f, confirmPhone: onlyDigits(e.target.value).slice(0, 13) }))} className="sf-input mt-2 w-full" /></div>
                <div><label htmlFor="pq-message" className="sf-label">Mensaje para el vendedor <span className="sf-faint">(opcional)</span></label><textarea id="pq-message" rows={4} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} className="sf-input mt-2 w-full" placeholder="Si quieres, cuéntanos algo más: qué vehículo buscas o cualquier detalle importante." /></div>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[0.9rem]"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={form.consent} onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))} /><span>Acepto que Elvis Automotores me contacte por WhatsApp por esta consulta. Mis datos se usan solo para evaluarla.</span></label>
              </div>
              {error && <p role="alert" className="mt-3 text-[0.9rem]" style={{ color: 'var(--sf-warn, #e0a23a)' }}>{error}</p>}
              <button type="submit" disabled={sending} className="sf-btn sf-btn-primary mt-6 min-h-14 w-full rounded-[12px] text-[1rem]">{sending ? 'Enviando…' : 'Enviar consulta'}</button>
            </form>
          )}
          {!done && (step > 0 || final) && (
            <button type="button" onClick={back} className="sf-btn sf-btn-ghost mt-4 min-h-11 rounded-[10px]"><ArrowLeft className="size-4" aria-hidden="true" />Volver</button>
          )}
        </div>
      </Container>
    </section>
  )
}
