'use client'
'use no memo'

import { useEffect, useState } from 'react'
import { Ticket, Trophy } from 'lucide-react'
import { Container } from './Container'
import { VehicleCard } from './VehicleCard'
import { useLiveVehicles } from './LiveVehicles'
import { ProgressiveOfferCard, type PublicProgressiveOffer } from './ProgressiveOfferCard'
import { applyCarChanges, isLocalDemo, listRaffles, offerSections, reserveRaffleNumber, saveSubmission, siteSettings, type OfferSection, type Raffle } from '../lib/localStore'

const STEP_MINUTES: Record<string, number> = { '1 hora': 60, '2 horas': 120, '6 horas': 360, '12 horas': 720, '1 día': 1440, '2 días': 2880, '1 semana': 10080 }

const money = (n: number) => `$ ${Math.round(n || 0).toLocaleString('es-AR')}`

/**
 * Progresivas. En la muestra local (offline) la oferta se mantiene siempre en curso:
 * se corre el inicio para que el precio vaya bajando "desde hoy".
 */
export function ProgressiveOffersList({ offers }: { offers: PublicProgressiveOffer[] }) {
  const [list, setList] = useState(offers)
  useEffect(() => {
    if (!isLocalDemo()) return
    const now = Date.now()
    const base = offers.map((offer) => {
      if (offer.status === 'sold') return offer
      return { ...offer, startsAt: new Date(now - offer.stepMinutes * 60000 + 1000).toISOString(), phase: 'live' }
    })
    setList(base)
    void fetch('/_offline/datos.json').then((r) => r.json()).then((d) => {
      const fromPanel = applyCarChanges(d.vehicles ?? []).filter((car) => car.ofertaSeccion === 'progresiva' && car.progresiva?.inicial).map((car): PublicProgressiveOffer => {
        const p = car.progresiva
        const img = (car.images ?? []).find((i: any) => i.isPrimary) ?? car.images?.[0]
        return {
          id: `panel-${car.id}`, number: null, title: `${car.make} ${car.model} ${car.year}`,
          imageUrl: img?.image?.url || (img?.imagePath ? `/images/vehicles/${String(img.imagePath).split('/').pop()}` : null),
          vehicleId: car.id, startsAt: new Date(p.desde || now).toISOString(), startPriceCents: p.inicial * 100, stepCents: p.baja * 100,
          stepMinutes: STEP_MINUTES[p.cada] ?? 60, floorPriceCents: (p.piso || 0) * 100, status: car.status === 'sold' ? 'sold' : 'active', phase: 'live',
          financing: '', conditions: p.condiciones || '', includesTransfer: true, walkIn: true,
        }
      })
      if (fromPanel.length) setList([...fromPanel, ...base])
    }).catch(() => {})
  }, [offers])
  const current = list.filter((offer) => offer.phase === 'live' || offer.phase === 'upcoming')
  const past = list.filter((offer) => offer.phase === 'sold' || offer.phase === 'final')
  return (
    <>
      {current.length > 0 ? current.map((offer) => <ProgressiveOfferCard key={offer.id} offer={offer} />) : (
        <div className="sf-well p-6">
          <p className="font-semibold">No hay una oferta progresiva en curso en este momento.</p>
          <p className="sf-muted mt-1 text-[length:var(--sf-text-sm)]">Las anunciamos en nuestro canal de WhatsApp: síguelo para enterarte de la próxima.</p>
        </div>
      )}
      {past.length > 0 && (
        <div className="pt-6">
          <h3 className="sf-display text-[1.3rem]">Ofertas recientes</h3>
          <div className="mt-6 grid gap-6 md:grid-cols-2">{past.map((offer) => <ProgressiveOfferCard key={offer.id} offer={offer} compact />)}</div>
        </div>
      )}
    </>
  )
}

/** Botones de las secciones creadas en el panel (solo muestra local). */
export function LocalOffersNav() {
  const [items, setItems] = useState<Array<[string, string]>>([])
  useEffect(() => {
    if (!isLocalDemo()) return
    const site = siteSettings()
    const extra: Array<[string, string]> = offerSections().filter((s) => s.activa).map((s) => [`seccion-${s.id}`, s.nombre])
    if (listRaffles().some((r) => r.estado !== 'cerrada')) extra.push(['rifa', site.rifaNombre?.trim() || 'Rifa'])
    setItems(extra)
  }, [])
  return <>{items.map(([id, name]) => <a key={id} href={`#${id}`} className="sf-btn sf-btn-primary min-h-12 rounded-[8px]">{name}</a>)}</>
}

/** Secciones propias y rifas (solo muestra local). */
export function LocalOffersExtras() {
  const [sections, setSections] = useState<OfferSection[]>([])
  const [raffles, setRaffles] = useState<Raffle[]>([])
  const [title, setTitle] = useState('Rifa')
  useEffect(() => {
    if (!isLocalDemo()) return
    setSections(offerSections().filter((s) => s.activa))
    setRaffles(listRaffles().filter((r) => r.estado !== 'cerrada'))
    setTitle(siteSettings().rifaNombre?.trim() || 'Rifa')
  }, [])
  return (
    <>
      {sections.map((section) => <SectionBlock key={section.id} section={section} />)}
      {raffles.length > 0 && (
        <section id="rifa" className="scroll-mt-24 border-t py-14" style={{ borderColor: 'var(--sf-rule)' }} aria-labelledby="rifa-title">
          <Container className="space-y-8">
            <h2 id="rifa-title" className="sf-display text-[clamp(1.4rem,3vw,2rem)]">{title}</h2>
            {raffles.map((raffle) => <RaffleCard key={raffle.id} initial={raffle} />)}
          </Container>
        </section>
      )}
    </>
  )
}

function SectionBlock({ section }: { section: OfferSection }) {
  const { items } = useLiveVehicles([], { AND: [{ status: { equals: 'available' } }, { ofertaSeccion: { equals: section.id } }] }, 48, [{ priceCents: 'asc' }])
  return (
    <section id={`seccion-${section.id}`} className="scroll-mt-24 border-t py-14" style={{ borderColor: 'var(--sf-rule)' }}>
      <Container>
        <h2 className="sf-display text-[clamp(1.4rem,3vw,2rem)]">{section.nombre}</h2>
        {section.descripcion && <p className="sf-muted mt-2 max-w-2xl">{section.descripcion}</p>}
        {items.length ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{items.map((v) => <VehicleCard key={v.id} vehicle={v} />)}</div>
        ) : (
          <div className="sf-well mt-8 p-6" role="status"><p className="font-semibold">No hay autos en esta sección en este momento.</p></div>
        )}
      </Container>
    </section>
  )
}

function RaffleCard({ initial }: { initial: Raffle }) {
  const [raffle, setRaffle] = useState(initial)
  const [pick, setPick] = useState<number | null>(null)
  const [form, setForm] = useState({ nombre: '', telefono: '' })
  const [msg, setMsg] = useState('')
  const taken = new Set(raffle.numeros.map((n) => n.numero))
  const free = raffle.cantidad - taken.size
  const winner = raffle.ganador

  function reserve(e: React.FormEvent) {
    e.preventDefault()
    if (pick == null) return
    if (!form.nombre.trim() || form.telefono.replace(/\D/g, '').length < 8) return setMsg('Completa tu nombre y un teléfono válido.')
    if (!reserveRaffleNumber(raffle.id, { numero: pick, nombre: form.nombre.trim(), telefono: form.telefono.trim() })) {
      setMsg('Ese número se acaba de tomar. Elige otro.')
    } else {
      saveSubmission('rifa', `Rifa: número ${pick}`, { name: form.nombre.trim(), phone: form.telefono.trim(), message: `Reservó el número ${pick} de la rifa “${raffle.titulo}”.` })
      setMsg(`¡Listo! Reservaste el número ${pick}. Te contactamos para confirmar el pago.`)
      setPick(null)
    }
    setRaffle(listRaffles().find((r) => r.id === raffle.id) ?? raffle)
  }

  return (
    <article className="elv-panel grid gap-5">
      <div>
        <p className="elv-eyebrow"><Ticket className="mr-1 inline size-4" aria-hidden="true" />{raffle.titulo}</p>
        <h3 className="sf-display mt-2 text-[1.5rem]">Premio: {raffle.premio}</h3>
        <p className="sf-muted mt-2">{money(raffle.precioNumero)} por número · {free} de {raffle.cantidad} libres{raffle.fechaSorteo ? ` · sorteo el ${raffle.fechaSorteo.split('-').reverse().join('/')}` : ''}</p>
      </div>
      {winner != null ? (
        <p className="text-[1.2rem] font-bold" style={{ color: 'var(--sf-accent)' }}><Trophy className="mr-2 inline size-5" aria-hidden="true" />Número ganador: {winner}</p>
      ) : (
        <>
          <div className="grid max-h-72 grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-2 overflow-y-auto" role="group" aria-label="Números">
            {Array.from({ length: raffle.cantidad }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" disabled={taken.has(n)} aria-pressed={pick === n} onClick={() => { setPick(n); setMsg('') }}
                className="min-h-11 rounded-[8px] border text-[0.9rem] font-semibold disabled:cursor-not-allowed disabled:opacity-30 disabled:line-through"
                style={pick === n ? { background: 'var(--sf-gold-gradient)', color: 'var(--sf-accent-ink)', borderColor: 'transparent' } : { borderColor: 'var(--sf-rule)' }}>
                {n}
              </button>
            ))}
          </div>
          {pick != null && (
            <form onSubmit={reserve} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div><label htmlFor={`rn-${raffle.id}`} className="sf-label">Tu nombre</label><input id={`rn-${raffle.id}`} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="sf-input mt-2 w-full" autoComplete="name" /></div>
              <div><label htmlFor={`rt-${raffle.id}`} className="sf-label">Teléfono / WhatsApp</label><input id={`rt-${raffle.id}`} inputMode="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="sf-input mt-2 w-full" autoComplete="tel" /></div>
              <button type="submit" className="sf-btn sf-btn-primary min-h-12 rounded-[8px]">Reservar el {pick}</button>
            </form>
          )}
        </>
      )}
      {msg && <p role="status" className="font-semibold">{msg}</p>}
      {raffle.bases && <details><summary className="sf-link min-h-11 cursor-pointer">Bases y condiciones</summary><p className="sf-muted mt-2 whitespace-pre-line text-[0.9rem]">{raffle.bases}</p></details>}
    </article>
  )
}
