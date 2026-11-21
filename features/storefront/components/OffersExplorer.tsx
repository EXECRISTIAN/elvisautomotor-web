'use client'
'use no memo'

import { useEffect, useMemo, useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Container } from './Container'
import { VehicleCard } from './VehicleCard'
import { ComboField } from './ComboField'
import { ExpressOffersGrid } from './LiveSections'
import { useLiveVehicles } from './LiveVehicles'
import { ProgressiveOffersList } from './LocalOffersExtras'
import type { PublicProgressiveOffer } from './ProgressiveOfferCard'
import type { Vehicle } from '../lib/types'
import { isLocalDemo, offerSections, siteSettings, type OfferSection } from '../lib/localStore'
import { vehicleKind } from '@/features/lib/vehicleKinds'
import { fuelLabel, transmissionLabel } from '@/features/lib/vehicleSpecs'

type Filters = Record<'tipo' | 'condicion' | 'marca' | 'modelo' | 'desde' | 'hasta' | 'carroceria' | 'traccion' | 'tipoTraccion' | 'combustible' | 'caja' | 'precio' | 'km', string>
const EMPTY: Filters = { tipo: '', condicion: '', marca: '', modelo: '', desde: '', hasta: '', carroceria: '', traccion: '', tipoTraccion: '', combustible: '', caja: '', precio: '', km: '' }
const uniq = (list: Array<string | number | null | undefined>) => [...new Set(list.filter((x) => x != null && x !== '').map(String))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
const isExpress = (v: Vehicle) => Boolean(v.previousPrice && v.previousPrice > v.price)

/** /ofertas: filtros de búsqueda sobre todas las ofertas disponibles; primero lo que hay, al final lo vacío. */
export function OffersExplorer({ vehicles: initial, offers }: { vehicles: Vehicle[]; offers: PublicProgressiveOffer[] }) {
  const { items: vehicles } = useLiveVehicles(initial, { AND: [{ status: { equals: 'available' } }] }, 100)
  const [local, setLocal] = useState(false)
  const [sections, setSections] = useState<OfferSection[]>([])
  const [names, setNames] = useState({ express: 'Ofertas express', progresiva: 'Ofertas progresivas' })
  const [f, setF] = useState<Filters>(EMPTY)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!isLocalDemo()) return
    const site = siteSettings()
    setLocal(true)
    setSections(offerSections().filter((s) => s.activa))
    setNames({ express: site.ofertaExpressNombre?.trim() || 'Ofertas express', progresiva: site.ofertaProgresivaNombre?.trim() || 'Ofertas progresivas' })
  }, [])

  const liveOffers = offers.filter((o) => o.status !== 'sold' && (local || o.phase === 'live' || o.phase === 'upcoming'))
  const progIds = new Set(liveOffers.map((o) => o.vehicleId).filter(Boolean) as string[])
  const types = (v: Vehicle & Record<string, any>) => {
    const t: string[] = []
    if (isExpress(v)) t.push('express')
    if (progIds.has(v.id) || v.ofertaSeccion === 'progresiva') t.push('progresiva')
    if (v.ofertaSeccion && v.ofertaSeccion !== 'express' && v.ofertaSeccion !== 'progresiva') t.push(v.ofertaSeccion)
    return t
  }
  // Ofertas progresivas sin auto vinculado: se arma un auto "de referencia" con el título (marca, modelo, año).
  const offerCars = liveOffers.filter((o) => !o.vehicleId).map((o) => {
    const year = Number(/\b(19|20)\d{2}\b/.exec(o.title)?.[0]) || 0
    const words = o.title.replace(/\b(19|20)\d{2}\b.*$/, '').trim().split(/\s+/)
    return { id: `offer-${o.id}`, make: words[0] ?? '', model: words.slice(1).join(' '), trim: '', year, price: o.startPriceCents / 100, mileage: 0, condition: 'used', fuelType: /gasolina|nafta/i.test(o.title) ? 'gasoline' : null, transmission: null, ofertaSeccion: 'progresiva' } as any
  })
  const offered = [...vehicles.filter((v) => types(v as any).length), ...offerCars]
  const typeLabel = (id: string) => (id === 'express' ? names.express : id === 'progresiva' ? names.progresiva : sections.find((s) => s.id === id)?.nombre ?? id)
  const typeIds = ['express', 'progresiva', ...sections.map((s) => s.id)]

  const vehicleOk = (v: Vehicle & Record<string, any>, skip?: keyof Filters) => {
    const k = vehicleKind(v)
    const yes = (key: keyof Filters, ok: boolean) => skip === key || !f[key] || ok
    return yes('condicion', (f.condicion === '0 km') === (v.condition === 'new'))
      && yes('marca', v.make === f.marca) && yes('modelo', v.model === f.modelo)
      && yes('desde', v.year >= Number(f.desde)) && yes('hasta', v.year <= Number(f.hasta))
      && yes('carroceria', k.carroceria === f.carroceria) && yes('traccion', k.traccion === f.traccion) && yes('tipoTraccion', k.tipoTraccion === f.tipoTraccion)
      && yes('combustible', fuelLabel(v.fuelType ?? '') === f.combustible) && yes('caja', transmissionLabel(v.transmission ?? '') === f.caja)
      && yes('precio', v.price <= Number(f.precio.replace(/\D/g, ''))) && yes('km', (v.mileage || 0) <= Number(f.km.replace(/\D/g, '')))
  }
  const typeOk = (v: Vehicle) => !f.tipo || types(v as any).includes(typeIds.find((id) => typeLabel(id) === f.tipo) ?? f.tipo)
  const results = offered.filter((v) => vehicleOk(v as any) && typeOk(v))
  // Opciones: solo valores que existen en las ofertas disponibles (con los demás filtros aplicados).
  const opts = (key: keyof Filters, get: (v: any) => string | number | null | undefined) => uniq(offered.filter((v) => vehicleOk(v as any, key) && typeOk(v)).map(get))
  const active = Object.values(f).filter(Boolean).length
  const set = (patch: Partial<Filters>) => setF((prev) => ({ ...prev, ...patch }))

  const vehicleFiltersOn = Object.entries(f).some(([k, v]) => k !== 'tipo' && v)
  const progOffers = useMemo(() => offers.filter((o) => {
    if (!vehicleFiltersOn) return true
    const v = o.vehicleId ? vehicles.find((x) => x.id === o.vehicleId) : offerCars.find((x: any) => x.id === `offer-${o.id}`)
    return v ? vehicleOk(v as any) : false
  }), [offers, vehicles, f, offerCars.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const progCount = results.filter((v) => types(v as any).includes('progresiva')).length

  const blocks = typeIds.filter((id) => !f.tipo || typeLabel(id) === f.tipo).map((id) => {
    const list = results.filter((v) => !String(v.id).startsWith('offer-') && types(v as any).includes(id))
    const count = id === 'progresiva' ? progCount : list.length
    return { id, list, count }
  }).sort((a, b) => Number(b.count > 0) - Number(a.count > 0))

  const select = (key: keyof Filters, label: string, options: string[], numeric = false) => (
    <div><span className="sf-label">{label}</span><div className="mt-2"><ComboField id={`of-${key}`} value={f[key]} onChange={(v) => set({ [key]: v, ...(key === 'marca' ? { modelo: '' } : {}) } as Partial<Filters>)} options={options} allowCustom={false} placeholder="Todos" inputMode={numeric ? 'numeric' : 'text'} emptyText="Sin opciones disponibles" /></div></div>
  )

  return (
    <>
      <section className="border-b py-6" style={{ borderColor: 'var(--sf-rule)' }} aria-label="Filtros de ofertas">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold" role="status">{results.length} {results.length === 1 ? 'oferta disponible' : 'ofertas disponibles'}</p>
            <div className="flex flex-wrap gap-2">
              {active > 0 && <button type="button" className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]" onClick={() => setF(EMPTY)}><X className="size-4" aria-hidden="true" />Limpiar filtros ({active})</button>}
              <button type="button" className="sf-btn sf-btn-outline min-h-11 rounded-[8px] lg:hidden" aria-expanded={open} onClick={() => setOpen(!open)}><SlidersHorizontal className="size-4" aria-hidden="true" />{open ? 'Ocultar filtros' : 'Filtrar'}</button>
            </div>
          </div>
          <div className={`${open ? 'grid' : 'hidden'} mt-4 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid lg:grid-cols-4 xl:grid-cols-5`}>
            {select('tipo', 'Tipo de oferta', typeIds.filter((id) => id === 'progresiva' ? progCount > 0 || liveOffers.length > 0 : offered.some((v) => types(v as any).includes(id))).map(typeLabel))}
            {select('condicion', '0 km / usado', opts('condicion', (v) => (v.condition === 'new' ? '0 km' : 'Usado')))}
            {select('marca', 'Marca', opts('marca', (v) => v.make))}
            {select('modelo', 'Modelo', opts('modelo', (v) => v.model))}
            {select('desde', 'Año desde', opts('desde', (v) => v.year), true)}
            {select('hasta', 'Año hasta', opts('hasta', (v) => v.year), true)}
            {select('carroceria', 'Tipo de vehículo', opts('carroceria', (v) => vehicleKind(v).carroceria))}
            {select('traccion', 'Tracción', opts('traccion', (v) => vehicleKind(v).traccion))}
            {select('tipoTraccion', 'Tipo de tracción', opts('tipoTraccion', (v) => vehicleKind(v).tipoTraccion))}
            {select('combustible', 'Combustible', opts('combustible', (v) => fuelLabel(v.fuelType ?? '')))}
            {select('caja', 'Caja', opts('caja', (v) => transmissionLabel(v.transmission ?? '')))}
            <div><label htmlFor="of-precio" className="sf-label">Precio hasta ($)</label><input id="of-precio" inputMode="numeric" value={f.precio} onChange={(e) => set({ precio: e.target.value.replace(/\D/g, '') })} className="sf-input mt-2 w-full" placeholder="Sin límite" /></div>
            <div><label htmlFor="of-km" className="sf-label">Kilómetros hasta</label><input id="of-km" inputMode="numeric" value={f.km} onChange={(e) => set({ km: e.target.value.replace(/\D/g, '') })} className="sf-input mt-2 w-full" placeholder="Sin límite" /></div>
          </div>
        </Container>
      </section>

      {blocks.map(({ id, list, count }) => (
        <section key={id} id={id === 'express' ? 'ofertas-express' : id === 'progresiva' ? 'ofertas-progresivas' : `seccion-${id}`} className="scroll-mt-24 border-b py-12" style={{ borderColor: 'var(--sf-rule)' }}>
          <Container className="space-y-6">
            <div>
              <h2 className="sf-display text-[clamp(1.4rem,3vw,2rem)]">{typeLabel(id)} <span className="sf-faint text-[1rem]">({count})</span></h2>
              {id === 'express' && <p className="sf-muted mt-2 max-w-2xl">Autos que en este momento están más baratos que su precio habitual.</p>}
              {id === 'progresiva' && <p className="sf-muted mt-2 max-w-3xl">El precio baja cada hora o cada día hasta que alguien se lo lleva. Hay una sola unidad: cuando se vende, termina la promo.</p>}
              {sections.find((s) => s.id === id)?.descripcion && <p className="sf-muted mt-2 max-w-2xl">{sections.find((s) => s.id === id)?.descripcion}</p>}
            </div>
            {id === 'progresiva' ? (
              <ProgressiveOffersList offers={progOffers} vehicleFilter={vehicleFiltersOn ? (vid) => { const v = vehicles.find((x) => x.id === vid); return v ? vehicleOk(v as any) : false } : undefined} />
            ) : id === 'express' && !active && !local ? (
              <ExpressOffersGrid initial={list} />
            ) : list.length ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{list.map((v) => <VehicleCard key={v.id} vehicle={v} />)}</div>
            ) : (
              <div className="sf-well p-6" role="status"><p className="font-semibold">{active ? 'Ninguna oferta coincide con los filtros.' : 'No hay ofertas en curso en esta sección en este momento.'}</p></div>
            )}
          </Container>
        </section>
      ))}
    </>
  )
}
