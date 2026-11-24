'use client'
'use no memo' // Lee datos guardados fuera de React (carpeta datos): sin memorización automática.

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Download, Pencil, Plus, Star, Trash2, X } from 'lucide-react'
import { ComboField } from '../components/ComboField'
import { PhotoPicker } from '../components/PhotoPicker'
import { applyCarChanges, offerSections, siteSettings, deleteCar, deletePhoto, logActivity, newId, savePhoto, saveCar, vehicleHref, type LocalCar } from '../lib/localStore'
import { BODY_TYPES, TRACCION, TIPO_TRACCION, vehicleKind } from '@/features/lib/vehicleKinds'
import { catalogMakes, POPULAR_MAKES, makeLogo, catalogModels, catalogVersions } from '@/features/lib/vehicleCatalog'
import { AC_OPTIONS, DEBT_OPTIONS, FINES_OPTIONS, FUEL_OPTIONS, GNC_OPTIONS, TRANSMISSION_OPTIONS, USED_REPORT_TEXT_FIELDS } from '@/features/lib/vehicleSpecs'

const money = (n: unknown) => (Number(n) > 0 ? Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }) : 'Sin precio')
const STATUS: Record<string, string> = { available: 'Disponible', reserved: 'Reservado', sold: 'Vendido' }
const YEARS = Array.from({ length: new Date().getFullYear() + 2 - 1900 }, (_, i) => String(new Date().getFullYear() + 1 - i))
const opt = (list: readonly { label: string; value: string }[]) => list.map((o) => o.label.replace(/ \(se informa abajo\)$/, ''))
const toValue = (list: readonly { label: string; value: string }[], label: string) => list.find((o) => o.label.replace(/ \(se informa abajo\)$/, '') === label)?.value ?? ''
const toLabel = (list: readonly { label: string; value: string }[], value?: string) => list.find((o) => o.value === value)?.label.replace(/ \(se informa abajo\)$/, '') ?? ''

function photoUrl(car: LocalCar) {
  const images = (car.images ?? []) as Array<{ image?: { url?: string } | null; imagePath?: string; isPrimary?: boolean }>
  const img = images.find((i) => i.isPrimary) ?? images[0]
  return img?.image?.url || (img?.imagePath ? `/images/vehicles/${img.imagePath.split('/').pop()}` : '')
}

export function LocalCarsTab({ user }: { user?: { name: string } }) {
  const [base, setBase] = useState<LocalCar[] | null>(null)
  const [version, setVersion] = useState(0)
  const [editing, setEditing] = useState<LocalCar | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetch('/_offline/datos.json').then((r) => r.json()).then((d) => setBase(d.vehicles ?? [])).catch(() => setBase([]))
  }, [])

  const cars = useMemo(() => (base ? applyCarChanges(base) : []), [base, version])
  const shown = cars.filter((car) => !query || `${car.year} ${car.make} ${car.model} ${car.trim} ${car.stockNumber} ${car.patente ?? ''} ${String(car.patente ?? '').replace(/\s/g, '')}`.toLowerCase().includes(query.toLowerCase()))

  const startNew = () => {
    setError('')
    setEditing({ id: newId('auto').toLowerCase(), __new: true, vin: '', year: new Date().getFullYear(), make: '', model: '', trim: '', condition: 'used', status: 'available', price: 0, previousPrice: null, mileage: 0, color: '', fuelType: 'nafta', transmission: 'manual', engine: '', stockNumber: `L-${String(cars.length + 1).padStart(3, '0')}`, isFeatured: false, description: '', features: [], images: [], usedReport: {} })
  }

  async function addPhotos(files: File[]) {
    if (!editing) return
    setBusy(true)
    try {
      const urls: string[] = []
      for (const file of files.filter((f) => f.type.startsWith('image/')).slice(0, 20)) urls.push(await savePhoto(file))
      const images = [...(editing.images ?? []), ...urls.map((url, i) => ({ id: newId('img'), imagePath: '', image: { url }, isPrimary: !(editing.images ?? []).length && i === 0, sortOrder: (editing.images ?? []).length + i }))]
      setEditing({ ...editing, images })
    } finally {
      setBusy(false)
    }
  }
  function removePhoto(index: number) {
    if (!editing) return
    const images = [...(editing.images ?? [])]
    const [removed] = images.splice(index, 1)
    if (removed?.image?.url?.startsWith('/_local/')) deletePhoto(removed.image.url)
    if (removed?.isPrimary && images[0]) images[0] = { ...images[0], isPrimary: true }
    setEditing({ ...editing, images })
  }
  function movePhoto(index: number, delta: number) {
    if (!editing) return
    const images = [...(editing.images ?? [])]
    const to = index + delta
    if (to < 0 || to >= images.length) return
    ;[images[index], images[to]] = [images[to], images[index]]
    setEditing({ ...editing, images })
  }
  function duplicate(car: LocalCar) {
    setError('')
    setEditing({ ...car, id: newId('auto').toLowerCase(), __new: true, vin: '', patente: '', status: 'available', stockNumber: `L-${String(cars.length + 1).padStart(3, '0')}`, images: [], usedReport: car.usedReport ?? {} })
  }
  function makePrimary(index: number) {
    if (!editing) return
    setEditing({ ...editing, images: (editing.images ?? []).map((img: any, i: number) => ({ ...img, isPrimary: i === index })) })
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!editing) return
    if (!String(editing.make).trim() || !String(editing.model).trim() || !Number(editing.year)) { setError('Completa marca, modelo y año.'); return }
    if (!(Number(editing.price) > 0)) { setError('Indica el precio.'); return }
    if (editing.ofertaSeccion === 'progresiva') {
      const p = { inicial: 0, baja: 0, piso: 0, ...(editing.progresiva ?? {}) }
      if (!p.inicial || !p.baja) { setError('Para la oferta progresiva carga el precio inicial y cuánto baja.'); return }
      if (p.piso >= p.inicial) { setError('El precio final tiene que ser menor que el inicial.'); return }
      if (!editing.progresiva?.desde) editing.progresiva = { ...prog, ...editing.progresiva }
    }
    if (editing.ofertaSeccion === 'express' && !editing.previousPrice) { setError('Para mostrarlo en la oferta express carga el precio anterior (más alto que el actual).'); return }
    if (editing.previousPrice && Number(editing.previousPrice) <= Number(editing.price)) { setError('El precio anterior (oferta express) tiene que ser mayor al precio actual. Déjalo vacío si no está en oferta.'); return }
    const report = editing.condition === 'new' ? null : Object.fromEntries(Object.entries(editing.usedReport ?? {}).filter(([, v]) => v !== '' && v != null))
    saveCar({ ...editing, year: Number(editing.year), price: Number(editing.price), previousPrice: editing.previousPrice ? Number(editing.previousPrice) : null, mileage: editing.condition === 'new' ? 0 : Number(editing.mileage) || 0, usedReport: report && Object.keys(report).length ? report : null })
    logActivity(user?.name ?? '', `${editing.__new ? 'Publicó' : 'Editó'} ${editing.year} ${editing.make} ${editing.model}`)
    setEditing(null)
    setVersion((v) => v + 1)
  }
  function remove(car: LocalCar) {
    if (!window.confirm(`¿Borrar ${car.year} ${car.make} ${car.model}? Deja de verse en el sitio.`)) return
    deleteCar(car.id)
    logActivity(user?.name ?? '', `Borró ${car.year} ${car.make} ${car.model}`)
    setVersion((v) => v + 1)
  }
  function quick(car: LocalCar, patch: Partial<LocalCar>) {
    saveCar({ ...car, ...patch })
    logActivity(user?.name ?? '', `${patch.status === 'sold' ? 'Marcó como vendido' : 'Volvió a publicar'} ${car.year} ${car.make} ${car.model}`)
    setVersion((v) => v + 1)
  }

  const set = (patch: Partial<LocalCar>) => editing && setEditing({ ...editing, ...patch })
  const setReport = (patch: Record<string, unknown>) => editing && setEditing({ ...editing, usedReport: { ...(editing.usedReport ?? {}), ...patch } })
  const field = 'sf-input mt-2 w-full'
  function exportCars() {
    const head = ['Año', 'Marca', 'Modelo', 'Versión', 'Patente', 'Stock', '0 km / usado', 'Tipo de vehículo', 'Tracción', 'Tipo de tracción', 'Kilometraje', 'Precio', 'Precio anterior', 'Estado', 'Oferta']
    const rows = shown.map((car) => { const k = vehicleKind(car as Record<string, string>); return [car.year, car.make, car.model, car.trim, car.patente ?? '', car.stockNumber ?? '', car.condition === 'new' ? '0 km' : 'Usado', k.carroceria, k.traccion, k.tipoTraccion, car.mileage ?? 0, car.price ?? 0, car.previousPrice ?? '', STATUS[car.status] ?? car.status, offerLabel(car)] })
    const csv = '\ufeff' + [head, ...rows].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `elvis-autos-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click(); URL.revokeObjectURL(url)
  }
  const kind = vehicleKind((editing ?? {}) as Record<string, string>)
  const prog = { inicial: 0, baja: 0, cada: '1 hora', piso: 0, desde: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16), condiciones: '', ...(editing?.progresiva ?? {}) }
  const setProg = (patch: Record<string, unknown>) => editing && setEditing({ ...editing, progresiva: { ...prog, ...patch } })
  const sections = offerSections().filter((sec) => sec.activa)
  const site = siteSettings()
  const expressName = site.ofertaExpressNombre?.trim() || 'Ofertas express'
  const progName = site.ofertaProgresivaNombre?.trim() || 'Oferta progresiva'
  const offerOptions = ['No', expressName, progName, ...sections.map((sec) => sec.nombre)]
  const offerLabel = (car: LocalCar) => car.ofertaSeccion === 'express' ? expressName : car.ofertaSeccion === 'progresiva' ? progName : sections.find((sec) => sec.id === car.ofertaSeccion)?.nombre ?? (car.previousPrice ? expressName : 'No')
  const setOffer = (label: string) => set({ ofertaSeccion: label === expressName ? 'express' : label === progName ? 'progresiva' : sections.find((sec) => sec.nombre === label)?.id ?? '' })

  if (base === null) return <p className="sf-muted mt-6">Cargando autos…</p>

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end gap-3">
        <button type="button" className="sf-btn sf-btn-primary min-h-12 rounded-[10px]" onClick={startNew}><Plus className="size-4" aria-hidden="true" />Agregar auto</button>
        <button type="button" className="sf-btn sf-btn-outline min-h-12 rounded-[10px]" disabled={!shown.length} onClick={exportCars}><Download className="size-4" aria-hidden="true" />Exportar a Excel</button>
        <div className="min-w-0 flex-1 sm:max-w-xs"><label htmlFor="lc-q" className="sf-label">Buscar</label><input id="lc-q" value={query} onChange={(e) => setQuery(e.target.value)} className={field} placeholder="Patente, marca, modelo o stock" /></div>
      </div>

      {editing && (
        <form onSubmit={save} className="elv-pq-panel mt-4 grid gap-4">
          <h2 className="sf-display text-[1.3rem]">{editing.__new ? 'Agregar auto' : `Editar ${editing.year} ${editing.make} ${editing.model}`}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><span className="sf-label">Estado</span><div className="sf-track sf-track-choices mt-2">{[['used', 'Usado'], ['new', '0 km']].map(([v, l]) => <button key={v} type="button" className="sf-pill min-h-11" aria-pressed={editing.condition === v} onClick={() => set({ condition: v })}>{l}</button>)}</div></div>
            <div><label htmlFor="lc-year" className="sf-label">Año</label><div className="mt-2"><ComboField id="lc-year" value={String(editing.year || '')} onChange={(v) => set({ year: v })} options={YEARS} inputMode="numeric" maxLength={4} allowCustom={false} /></div></div>
            <div><label htmlFor="lc-make" className="sf-label">Marca</label><div className="mt-2"><ComboField id="lc-make" value={editing.make} onChange={(v) => set({ make: v, model: v === editing.make ? editing.model : '' })} options={catalogMakes(editing.year)} popular={POPULAR_MAKES} icon={makeLogo} allLabel="Todas las marcas" /></div></div>
            <div><label htmlFor="lc-model" className="sf-label">Modelo</label><div className="mt-2"><ComboField id="lc-model" value={editing.model} onChange={(v) => set({ model: v })} options={catalogModels(editing.make, editing.year)} emptyText="Escribe el modelo" /></div></div>
            <div><label htmlFor="lc-trim" className="sf-label">Versión</label><div className="mt-2"><ComboField id="lc-trim" value={editing.trim} onChange={(v) => set({ trim: v })} options={catalogVersions(editing.make, editing.model, editing.year)} emptyText="Escribe la versión" /></div></div>
            <div><label htmlFor="lc-price" className="sf-label">Precio ($)</label><input id="lc-price" inputMode="numeric" value={(editing.price) ? Number(editing.price).toLocaleString('es-AR') : ''} onChange={(e) => set({ price: e.target.value.replace(/\D/g, '') })} className={field} placeholder="Ej.: 25000000" /></div>
            <div><label htmlFor="lc-prev" className="sf-label">Precio anterior <span className="sf-faint">(oferta express)</span></label><input id="lc-prev" inputMode="numeric" value={(editing.previousPrice) ? Number(editing.previousPrice).toLocaleString('es-AR') : ''} onChange={(e) => set({ previousPrice: e.target.value.replace(/\D/g, '') || null })} className={field} placeholder="Vacío si no está en oferta" /></div>
            {editing.condition !== 'new' && <div><label htmlFor="lc-km" className="sf-label">Kilometraje</label><input id="lc-km" inputMode="numeric" value={(editing.mileage) ? Number(editing.mileage).toLocaleString('es-AR') : ''} onChange={(e) => set({ mileage: e.target.value.replace(/\D/g, '') })} className={field} /></div>}
            <div><label htmlFor="lc-fuel" className="sf-label">Combustible</label><div className="mt-2"><ComboField id="lc-fuel" value={toLabel(FUEL_OPTIONS, editing.fuelType)} onChange={(v) => set({ fuelType: toValue(FUEL_OPTIONS, v) })} options={opt(FUEL_OPTIONS)} allowCustom={false} /></div></div>
            <div><label htmlFor="lc-trans" className="sf-label">Caja</label><div className="mt-2"><ComboField id="lc-trans" value={toLabel(TRANSMISSION_OPTIONS, editing.transmission)} onChange={(v) => set({ transmission: toValue(TRANSMISSION_OPTIONS, v) })} options={opt(TRANSMISSION_OPTIONS)} allowCustom={false} /></div></div>
            <div><span className="sf-label">Tipo de vehículo</span><div className="mt-2"><ComboField id="lc-body" value={editing.carroceria || kind.carroceria} onChange={(v) => set({ carroceria: v })} options={BODY_TYPES} allowCustom={false} /></div></div>
            <div><span className="sf-label">Tracción</span><div className="mt-2"><ComboField id="lc-trac" value={editing.traccion || kind.traccion} onChange={(v) => set({ traccion: v })} options={TRACCION} allowCustom={false} /></div></div>
            <div><span className="sf-label">Tipo de tracción</span><div className="mt-2"><ComboField id="lc-trac-tipo" value={editing.tipoTraccion || kind.tipoTraccion} onChange={(v) => set({ tipoTraccion: v })} options={TIPO_TRACCION} allowCustom={false} /></div></div>
            <div><label htmlFor="lc-engine" className="sf-label">Motor</label><input id="lc-engine" value={editing.engine || ''} onChange={(e) => set({ engine: e.target.value })} className={field} placeholder="Ej.: 1.6" /></div>
            <div><label htmlFor="lc-color" className="sf-label">Color</label><input id="lc-color" value={editing.color || ''} onChange={(e) => set({ color: e.target.value })} className={field} /></div>
            <div><label htmlFor="lc-plate" className="sf-label">Patente</label><input id="lc-plate" value={editing.patente || ''} onChange={(e) => set({ patente: e.target.value.toUpperCase() })} className={field} placeholder="Ej.: AB123CD" autoCapitalize="characters" /></div>
            <div><span className="sf-label">Mostrar en ofertas</span><div className="mt-2"><ComboField id="lc-offer" value={offerLabel(editing)} onChange={(v) => setOffer(v)} options={offerOptions} allowCustom={false} /></div></div>
            <div><label htmlFor="lc-stock" className="sf-label">Stock n.º</label><input id="lc-stock" value={editing.stockNumber || ''} onChange={(e) => set({ stockNumber: e.target.value })} className={field} /></div>
            <div><span className="sf-label">Disponibilidad</span><div className="mt-2"><ComboField id="lc-status" value={STATUS[editing.status] ?? 'Disponible'} onChange={(v) => set({ status: Object.keys(STATUS).find((k) => STATUS[k] === v) ?? 'available' })} options={Object.values(STATUS)} allowCustom={false} /></div></div>
          </div>
          {editing.ofertaSeccion === 'progresiva' && (
            <fieldset className="grid gap-4 rounded-[10px] border p-4 sm:grid-cols-2 lg:grid-cols-5" style={{ borderColor: 'var(--sf-rule)' }}>
              <legend className="sf-label px-1">{progName}: el precio baja solo hasta que alguien se lo lleva</legend>
              <div><label htmlFor="pg-ini" className="sf-label">Precio inicial ($)</label><input id="pg-ini" inputMode="numeric" value={(prog.inicial) ? Number(prog.inicial).toLocaleString('es-AR') : ''} onChange={(e) => setProg({ inicial: Number(e.target.value.replace(/\D/g, '')) })} className={field} /></div>
              <div><label htmlFor="pg-baja" className="sf-label">Baja ($)</label><input id="pg-baja" inputMode="numeric" value={(prog.baja) ? Number(prog.baja).toLocaleString('es-AR') : ''} onChange={(e) => setProg({ baja: Number(e.target.value.replace(/\D/g, '')) })} className={field} /></div>
              <div><span className="sf-label">Cada</span><div className="mt-2"><ComboField id="pg-cada" value={prog.cada} onChange={(v) => setProg({ cada: v })} options={['1 hora', '2 horas', '6 horas', '12 horas', '1 día', '2 días', '1 semana']} allowCustom={false} /></div></div>
              <div><label htmlFor="pg-piso" className="sf-label">Precio final ($)</label><input id="pg-piso" inputMode="numeric" value={(prog.piso) ? Number(prog.piso).toLocaleString('es-AR') : ''} onChange={(e) => setProg({ piso: Number(e.target.value.replace(/\D/g, '')) })} className={field} placeholder="0 = gratis" /></div>
              <div><label htmlFor="pg-ini-f" className="sf-label">Empieza</label><input id="pg-ini-f" type="datetime-local" value={prog.desde} onChange={(e) => setProg({ desde: e.target.value })} className={field} /></div>
              <div className="sm:col-span-2 lg:col-span-5"><label htmlFor="pg-cond" className="sf-label">Condiciones <span className="sf-faint">(opcional)</span></label><input id="pg-cond" value={prog.condiciones || ''} onChange={(e) => setProg({ condiciones: e.target.value })} className={field} placeholder="Ej.: contado, se entrega como está" /></div>
            </fieldset>
          )}
          <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="size-5" checked={Boolean(editing.isFeatured)} onChange={(e) => set({ isFeatured: e.target.checked })} />Destacado en la página principal</label>
          <div><label htmlFor="lc-desc" className="sf-label">Descripción</label><textarea id="lc-desc" rows={3} value={editing.description || ''} onChange={(e) => set({ description: e.target.value })} className={field} /></div>

          <div>
            <p className="sf-label">Fotos <span className="sf-faint">(la marcada con ★ es la principal)</span></p>
            {(editing.images ?? []).length > 0 && (
              <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {(editing.images ?? []).map((img: any, index: number) => (
                  <li key={img.id ?? index} className="relative aspect-square overflow-hidden rounded-[8px] border" style={{ borderColor: img.isPrimary ? 'var(--sf-accent)' : 'var(--sf-rule)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.image?.url || (img.imagePath ? `/images/vehicles/${String(img.imagePath).split('/').pop()}` : '')} alt={`Foto ${index + 1}`} className="size-full object-cover" />
                    <button type="button" onClick={() => makePrimary(index)} className="absolute left-1 top-1 grid size-9 place-items-center rounded-full bg-black/70 text-white" aria-label={`Usar la foto ${index + 1} como principal`} aria-pressed={Boolean(img.isPrimary)}><Star className={`size-4 ${img.isPrimary ? 'fill-current text-[var(--sf-accent)]' : ''}`} aria-hidden="true" /></button>
                    <span className="absolute bottom-1 left-1 flex gap-1">
                      <button type="button" disabled={index === 0} onClick={() => movePhoto(index, -1)} className="grid size-9 place-items-center rounded-full bg-black/70 text-white disabled:opacity-30" aria-label={`Mover la foto ${index + 1} antes`}><ChevronLeft className="size-4" aria-hidden="true" /></button>
                      <button type="button" disabled={index === (editing.images ?? []).length - 1} onClick={() => movePhoto(index, 1)} className="grid size-9 place-items-center rounded-full bg-black/70 text-white disabled:opacity-30" aria-label={`Mover la foto ${index + 1} después`}><ChevronRight className="size-4" aria-hidden="true" /></button>
                    </span>
                    <button type="button" onClick={() => removePhoto(index)} className="absolute right-1 top-1 grid size-9 place-items-center rounded-full bg-black/70 text-white" aria-label={`Quitar foto ${index + 1}`}><X className="size-4" aria-hidden="true" /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3"><PhotoPicker onFiles={addPhotos} disabled={busy} /></div>
            {busy && <p className="sf-muted mt-2 text-[0.85rem]" role="status">Guardando fotos…</p>}
          </div>

          {editing.condition !== 'new' && (
            <fieldset className="grid gap-4 border-t pt-4" style={{ borderColor: 'var(--sf-rule)' }}>
              <legend className="sf-label pt-2">Estado del usado (informe que ve el comprador)</legend>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {([['usedDebt', 'Deuda', DEBT_OPTIONS], ['usedFines', 'Infracciones', FINES_OPTIONS], ['usedGnc', 'GNC', GNC_OPTIONS], ['usedAc', 'Aire acondicionado', AC_OPTIONS]] as const).map(([key, label, list]) => (
                  <div key={key}><label htmlFor={`lc-${key}`} className="sf-label">{label}</label><div className="mt-2"><ComboField id={`lc-${key}`} value={toLabel(list, editing.usedReport?.[key])} onChange={(v) => setReport({ [key]: toValue(list, v) })} options={opt(list)} allowCustom={false} placeholder="Sin informar" /></div>
                    <input aria-label={`Detalle: ${label}`} value={editing.usedReport?.[`${key}Notes`] ?? ''} onChange={(e) => setReport({ [`${key}Notes`]: e.target.value })} className="sf-input mt-2 w-full" placeholder="Detalle (opcional)" /></div>
                ))}
                <div><label htmlFor="lc-tires" className="sf-label">Vida útil de cubiertas (%)</label><input id="lc-tires" inputMode="numeric" value={editing.usedReport?.usedTireLifePct ?? ''} onChange={(e) => { const n = e.target.value.replace(/\D/g, ''); setReport({ usedTireLifePct: n === '' ? '' : Math.min(100, Number(n)) }) }} className={field} placeholder="0 a 100" /></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {USED_REPORT_TEXT_FIELDS.map(([key, label]) => (
                  <div key={key}><label htmlFor={`lc-${key}`} className="sf-label">{label}</label><textarea id={`lc-${key}`} rows={2} value={editing.usedReport?.[key] ?? ''} onChange={(e) => setReport({ [key]: e.target.value })} className={field} /></div>
                ))}
              </div>
            </fieldset>
          )}

          {error && <p role="alert" className="text-[0.9rem]" style={{ color: 'var(--sf-warn, #e0a23a)' }}>{error}</p>}
          <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy} className="sf-btn sf-btn-primary min-h-12 rounded-[10px]">Guardar</button><button type="button" className="sf-btn sf-btn-ghost min-h-12 rounded-[10px]" onClick={() => setEditing(null)}>Cancelar</button></div>
        </form>
      )}

      <p className="sf-faint mt-4 text-[0.8rem]">{cars.length} autos · {cars.filter((c) => c.condition === 'new').length} 0 km · {cars.filter((c) => c.condition !== 'new').length} usados</p>
      <ul className="mt-3 grid gap-3">
        {shown.map((car) => (
          <li key={car.id} className="elv-pq-panel !p-3 flex flex-wrap items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photoUrl(car) ? <img src={photoUrl(car)} alt="" className="h-16 w-24 shrink-0 rounded-[6px] object-cover" /> : <span className="grid h-16 w-24 shrink-0 place-items-center rounded-[6px] text-[0.7rem]" style={{ background: 'var(--sf-rule)' }}>Sin foto</span>}
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{car.year} {car.make} {car.model} {car.trim}</span>
              <span className="sf-muted block text-[0.85rem]">{car.condition === 'new' ? '0 km' : 'Usado'}{car.patente ? ` · ${car.patente}` : ''} · {money(car.price)}{car.previousPrice > car.price ? ` (antes ${money(car.previousPrice)})` : ''} · {STATUS[car.status] ?? 'Disponible'}{car.isFeatured ? ' · Destacado' : ''}</span>
            </span>
            <span className="flex flex-wrap gap-2">
              <a href={vehicleHref(car.id)} target="_blank" rel="noreferrer" className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]">Ver</a>
              {car.status !== 'sold' ? <button type="button" className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]" onClick={() => quick(car, { status: 'sold' })}>Marcar vendido</button> : <button type="button" className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]" onClick={() => quick(car, { status: 'available' })}>Volver a publicar</button>}
              <button type="button" className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]" onClick={() => { setError(''); setEditing({ ...car, usedReport: car.usedReport ?? {} }) }}><Pencil className="size-4" aria-hidden="true" />Editar</button>
              <button type="button" className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]" onClick={() => duplicate(car)} aria-label={`Duplicar ${car.make} ${car.model}`} title="Duplicar (para cargar uno parecido)"><Copy className="size-4" aria-hidden="true" /></button>
              <button type="button" className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]" onClick={() => remove(car)} aria-label={`Borrar ${car.make} ${car.model}`}><Trash2 className="size-4" aria-hidden="true" /></button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
