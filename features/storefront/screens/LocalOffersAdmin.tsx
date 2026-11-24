'use client'
'use no memo'

import { useEffect, useState } from 'react'
import { Download, Plus, Printer, Trash2, Trophy } from 'lucide-react'
import {
  applyCarChanges, deleteRaffle, listRaffles, logActivity, newId, offerSections, saveOfferSections, saveRaffle, saveSiteSettings, siteSettings,
  type LocalCar, type LocalUser, type OfferSection, type Raffle,
} from '../lib/localStore'
import { ComboField } from '../components/ComboField'

function useBaseCars() {
  const [base, setBase] = useState<LocalCar[]>([])
  useEffect(() => { void fetch('/_offline/datos.json').then((r) => r.json()).then((d) => setBase(d.vehicles ?? [])).catch(() => {}) }, [])
  return applyCarChanges(base)
}

const money = (n: number) => `$ ${Math.round(n || 0).toLocaleString('es-AR')}`
const field = 'sf-input mt-2 w-full'

/** Panel local → Ofertas y rifas: nombres de secciones, secciones propias y rifas. */
export function OffersAdminSection({ user }: { user: LocalUser }) {
  const [, force] = useState(0)
  const refresh = () => force((n) => n + 1)
  const site = siteSettings()
  const [names, setNames] = useState({ express: site.ofertaExpressNombre ?? '', progresiva: site.ofertaProgresivaNombre ?? '', rifa: site.rifaNombre ?? '' })
  const [msg, setMsg] = useState('')
  const sections = offerSections()
  const allCars = useBaseCars()

  function saveNames() {
    saveSiteSettings({ ...siteSettings(), ofertaExpressNombre: names.express.trim(), ofertaProgresivaNombre: names.progresiva.trim(), rifaNombre: names.rifa.trim() })
    logActivity(user.name, 'Cambió los nombres de las secciones de ofertas')
    setMsg('Nombres guardados.')
  }
  function updateSection(id: string, patch: Partial<OfferSection>) {
    saveOfferSections(sections.map((sec) => (sec.id === id ? { ...sec, ...patch } : sec)))
    refresh()
  }
  function addSection() {
    saveOfferSections([...sections, { id: newId('sec').toLowerCase(), nombre: `Nueva sección ${sections.length + 1}`, descripcion: '', activa: true }])
    logActivity(user.name, 'Creó una sección de ofertas')
    refresh()
  }

  return (
    <div className="mt-6 grid gap-8">
      <section className="elv-pq-panel grid gap-4">
        <h2 className="sf-display text-[1.2rem]">Nombres de las secciones</h2>
        <p className="sf-muted text-[0.9rem]">Déjalo vacío para usar el nombre de siempre.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label htmlFor="of-exp" className="sf-label">Ofertas express</label><input id="of-exp" value={names.express} onChange={(e) => setNames({ ...names, express: e.target.value })} className={field} placeholder="Ofertas express" /></div>
          <div><label htmlFor="of-prog" className="sf-label">Ofertas progresivas</label><input id="of-prog" value={names.progresiva} onChange={(e) => setNames({ ...names, progresiva: e.target.value })} className={field} placeholder="Ofertas progresivas" /></div>
          <div><label htmlFor="of-rifa" className="sf-label">Rifa</label><input id="of-rifa" value={names.rifa} onChange={(e) => setNames({ ...names, rifa: e.target.value })} className={field} placeholder="Rifa" /></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="sf-btn sf-btn-primary min-h-12 rounded-[10px]" onClick={saveNames}>Guardar nombres</button>
          {msg && <span role="status" className="sf-muted">{msg}</span>}
        </div>
      </section>

      <section className="elv-pq-panel grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="sf-display text-[1.2rem]">Secciones de ofertas propias</h2>
          <button type="button" className="sf-btn sf-btn-primary min-h-12 rounded-[10px]" onClick={addSection}><Plus className="size-4" aria-hidden="true" />Nueva sección</button>
        </div>
        <p className="sf-muted text-[0.9rem]">Ej.: “Liquidación de usados”, “Ofertas de fin de mes”. Para poner un auto en una sección, edítalo en Autos → “Mostrar en ofertas”.</p>
        {sections.length === 0 && <p className="sf-faint">Todavía no hay secciones propias.</p>}
        {sections.map((sec) => {
          const count = allCars.filter((car: LocalCar) => car.ofertaSeccion === sec.id).length
          return (
            <div key={sec.id} className="grid gap-3 rounded-[10px] border p-4 sm:grid-cols-[1fr_2fr_auto]" style={{ borderColor: 'var(--sf-rule)' }}>
              <div><label htmlFor={`sn-${sec.id}`} className="sf-label">Nombre</label><input id={`sn-${sec.id}`} defaultValue={sec.nombre} onBlur={(e) => e.target.value.trim() && updateSection(sec.id, { nombre: e.target.value.trim() })} className={field} /></div>
              <div><label htmlFor={`sd-${sec.id}`} className="sf-label">Descripción</label><input id={`sd-${sec.id}`} defaultValue={sec.descripcion} onBlur={(e) => updateSection(sec.id, { descripcion: e.target.value })} className={field} /></div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex min-h-12 items-center gap-2"><input type="checkbox" className="size-5" checked={sec.activa} onChange={(e) => updateSection(sec.id, { activa: e.target.checked })} />Visible</label>
                <button type="button" aria-label={`Borrar ${sec.nombre}`} className="sf-btn sf-btn-ghost min-h-12 rounded-[10px]" onClick={() => { if (confirm(`¿Borrar la sección “${sec.nombre}”? Los autos quedan publicados, solo salen de la sección.`)) { saveOfferSections(sections.filter((x) => x.id !== sec.id)); refresh() } }}><Trash2 className="size-4" aria-hidden="true" /></button>
              </div>
              <p className="sf-faint text-[0.8rem] sm:col-span-3">{count} auto{count === 1 ? '' : 's'} en esta sección</p>
            </div>
          )
        })}
      </section>

      <RafflesAdmin user={user} />
    </div>
  )
}

function exportRaffle(r: Raffle) {
  const rows = [['Número', 'Nombre', 'Teléfono', 'Estado', 'Fecha', 'Ganador'], ...[...r.numeros].sort((a, b) => a.numero - b.numero).map((n) => [n.numero, n.nombre, n.telefono, n.estado === 'pagado' ? 'Pagado' : 'Reservado', new Date(n.fecha).toLocaleDateString('es-AR'), r.ganador === n.numero ? 'Sí' : ''])]
  const csv = '\ufeff' + rows.map((x) => x.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `rifa-${r.titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv` })
  a.click(); URL.revokeObjectURL(url)
}

function printRaffle(r: Raffle) {
  const esc = (t: unknown) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
  const taken = new Map(r.numeros.map((n) => [n.numero, n]))
  const cells = Array.from({ length: r.cantidad }, (_, i) => i + 1).map((num) => {
    const n = taken.get(num)
    return `<div class="c${n ? ' t' : ''}"><b>${String(num).padStart(String(r.cantidad).length, '0')}</b><span>${n ? esc(n.nombre) : '&nbsp;'}</span><small>${n ? (n.estado === 'pagado' ? 'Pagado' : 'Reservado') : ''}</small></div>`
  }).join('')
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Rifa ${esc(r.titulo)}</title><style>body{font-family:Arial,sans-serif;margin:16px;color:#000}h1{font-size:20px;margin:0}p{margin:4px 0 12px;font-size:13px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:4px}.c{border:1px solid #999;padding:4px;min-height:52px;font-size:11px;display:flex;flex-direction:column}.c b{font-size:15px}.t{background:#eee}@media print{button{display:none}}</style></head><body><button onclick="print()">Imprimir</button><h1>${esc(r.titulo)}</h1><p>Premio: ${esc(r.premio)} · Número: $${Number(r.precioNumero).toLocaleString('es-AR')} · Sorteo: ${esc(r.fechaSorteo || 'a definir')} · Vendidos ${r.numeros.length} de ${r.cantidad}</p><div class="g">${cells}</div></body></html>`)
  w.document.close()
}

const emptyRaffle = (): Raffle => ({ id: newId('rifa').toLowerCase(), titulo: '', premio: '', autoId: '', precioNumero: 0, cantidad: 100, fechaSorteo: '', estado: 'activa', bases: '', numeros: [], ganador: null, creada: new Date().toISOString() })

function RafflesAdmin({ user }: { user: LocalUser }) {
  const [, force] = useState(0)
  const refresh = () => force((n) => n + 1)
  const [editing, setEditing] = useState<Raffle | null>(null)
  const [sell, setSell] = useState({ numero: '', nombre: '', telefono: '' })
  const [error, setError] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const raffles = listRaffles()
  const cars = useBaseCars().filter((car: LocalCar) => car.status !== 'sold')
  const carLabel = (car: LocalCar) => `${car.year} ${car.make} ${car.model}${car.patente ? ` · ${car.patente}` : ''}`

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    if (!editing.titulo.trim() || !editing.premio.trim()) return setError('Completa el título y el premio.')
    if (!(editing.cantidad >= 2 && editing.cantidad <= 10000)) return setError('La cantidad de números tiene que estar entre 2 y 10.000.')
    if (editing.numeros.some((n) => n.numero > editing.cantidad)) return setError('Hay números vendidos más altos que la nueva cantidad.')
    saveRaffle(editing)
    logActivity(user.name, `Guardó la rifa “${editing.titulo}”`)
    setEditing(null); setError(''); refresh()
  }
  function addNumber(r: Raffle) {
    const numero = Number(sell.numero)
    if (!numero || numero < 1 || numero > r.cantidad) return setError(`Elige un número del 1 al ${r.cantidad}.`)
    if (r.numeros.some((n) => n.numero === numero)) return setError(`El número ${numero} ya está tomado.`)
    if (!sell.nombre.trim()) return setError('Escribe el nombre del comprador.')
    saveRaffle({ ...r, numeros: [...r.numeros, { numero, nombre: sell.nombre.trim(), telefono: sell.telefono.trim(), estado: 'pagado', fecha: new Date().toISOString() }] })
    logActivity(user.name, `Vendió el número ${numero} de la rifa “${r.titulo}”`)
    setSell({ numero: '', nombre: '', telefono: '' }); setError(''); refresh()
  }
  function draw(r: Raffle) {
    const paid = r.numeros.filter((n) => n.estado === 'pagado')
    if (!paid.length) return setError('No hay números pagados para sortear.')
    if (!confirm(`¿Sortear ahora entre ${paid.length} números pagados? Después no se puede deshacer.`)) return
    const pick = paid[crypto.getRandomValues(new Uint32Array(1))[0] % paid.length]
    saveRaffle({ ...r, estado: 'sorteada', ganador: pick.numero })
    logActivity(user.name, `Sorteó la rifa “${r.titulo}”: ganó el número ${pick.numero}`)
    refresh()
  }

  return (
    <section className="elv-pq-panel grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="sf-display text-[1.2rem]">Rifas</h2>
        <button type="button" className="sf-btn sf-btn-primary min-h-12 rounded-[10px]" onClick={() => { setEditing(emptyRaffle()); setError('') }}><Plus className="size-4" aria-hidden="true" />Nueva rifa</button>
      </div>
      <p className="sf-faint text-[0.8rem]">Importante: en Argentina las rifas necesitan autorización de Lotería de la Provincia (o del municipio). Carga en “Bases y condiciones” el número de autorización.</p>
      {error && <p role="alert" className="font-semibold" style={{ color: '#ff8a7a' }}>{error}</p>}

      {editing && (
        <form onSubmit={save} className="grid gap-4 rounded-[10px] border p-4" style={{ borderColor: 'var(--sf-rule)' }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="rf-t" className="sf-label">Título</label><input id="rf-t" value={editing.titulo} onChange={(e) => setEditing({ ...editing, titulo: e.target.value })} className={field} placeholder="Ej.: Gran rifa de fin de año" /></div>
            <div><label htmlFor="rf-auto" className="sf-label">Auto del stock <span className="sf-faint">(opcional)</span></label><div className="mt-2"><ComboField id="rf-auto" value={(() => { const car = cars.find((c: LocalCar) => c.id === editing.autoId); return car ? carLabel(car) : '' })()} onChange={(v) => { const car = cars.find((c: LocalCar) => carLabel(c) === v); setEditing({ ...editing, autoId: car?.id ?? '', premio: car ? `${car.year} ${car.make} ${car.model}` : editing.premio }) }} options={cars.map(carLabel)} allowCustom={false} placeholder="Elige un auto" /></div></div>
            <div><label htmlFor="rf-p" className="sf-label">Premio</label><input id="rf-p" value={editing.premio} onChange={(e) => setEditing({ ...editing, premio: e.target.value })} className={field} placeholder="Ej.: Volkswagen Gol 2015" /></div>
            <div><label htmlFor="rf-pr" className="sf-label">Precio por número ($)</label><input id="rf-pr" inputMode="numeric" value={(editing.precioNumero) ? Number(editing.precioNumero).toLocaleString('es-AR') : ''} onChange={(e) => setEditing({ ...editing, precioNumero: Number(e.target.value.replace(/\D/g, '')) })} className={field} /></div>
            <div><label htmlFor="rf-c" className="sf-label">Cantidad de números</label><input id="rf-c" inputMode="numeric" value={editing.cantidad || ''} onChange={(e) => setEditing({ ...editing, cantidad: Number(e.target.value.replace(/\D/g, '')) })} className={field} /></div>
            <div><label htmlFor="rf-f" className="sf-label">Fecha del sorteo</label><input id="rf-f" type="date" value={editing.fechaSorteo} onChange={(e) => setEditing({ ...editing, fechaSorteo: e.target.value })} className={field} /></div>
            <div><span className="sf-label">Estado</span><div className="mt-2"><ComboField id="rf-e" value={{ activa: 'Activa (se ve en la web)', cerrada: 'Cerrada (no se venden más)', sorteada: 'Sorteada' }[editing.estado]} onChange={(v) => setEditing({ ...editing, estado: v.startsWith('Activa') ? 'activa' : v.startsWith('Cerrada') ? 'cerrada' : 'sorteada' })} options={['Activa (se ve en la web)', 'Cerrada (no se venden más)', 'Sorteada']} allowCustom={false} /></div></div>
          </div>
          <div><label htmlFor="rf-b" className="sf-label">Bases y condiciones</label><textarea id="rf-b" rows={3} value={editing.bases} onChange={(e) => setEditing({ ...editing, bases: e.target.value })} className={field} placeholder="Autorización n.º, cómo se sortea, cómo se entrega el premio…" /></div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="sf-btn sf-btn-primary min-h-12 rounded-[10px]">Guardar rifa</button>
            <button type="button" className="sf-btn sf-btn-ghost min-h-12 rounded-[10px]" onClick={() => { setEditing(null); setError('') }}>Cancelar</button>
          </div>
        </form>
      )}

      {raffles.length === 0 && !editing && <p className="sf-faint">Todavía no hay rifas.</p>}
      {raffles.map((r) => {
        const paid = r.numeros.filter((n) => n.estado === 'pagado')
        return (
          <div key={r.id} className="rounded-[10px] border p-4" style={{ borderColor: 'var(--sf-rule)' }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold">{r.titulo} <span className="sf-faint text-[0.8rem]">· {r.estado}</span></p>
                <p className="sf-muted text-[0.85rem]">Premio: {r.premio} · {r.numeros.length}/{r.cantidad} números tomados · {paid.length} pagados · recaudado {money(paid.length * r.precioNumero)}{r.fechaSorteo ? ` · sorteo ${r.fechaSorteo.split('-').reverse().join('/')}` : ''}</p>
                {r.ganador != null && <p className="mt-1 font-semibold" style={{ color: 'var(--sf-accent)' }}><Trophy className="mr-1 inline size-4" aria-hidden="true" />Ganó el número {r.ganador}: {r.numeros.find((n) => n.numero === r.ganador)?.nombre} {r.numeros.find((n) => n.numero === r.ganador)?.telefono}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="sf-btn sf-btn-outline min-h-11 rounded-[10px]" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>Números</button>
                <button type="button" className="sf-btn sf-btn-outline min-h-11 rounded-[10px]" onClick={() => printRaffle(r)}><Printer className="size-4" aria-hidden="true" />Imprimir talonario</button>
                {r.numeros.length > 0 && <button type="button" className="sf-btn sf-btn-outline min-h-11 rounded-[10px]" onClick={() => exportRaffle(r)}><Download className="size-4" aria-hidden="true" />Excel</button>}
                <button type="button" className="sf-btn sf-btn-outline min-h-11 rounded-[10px]" onClick={() => { setEditing({ ...r }); setError('') }}>Editar</button>
                {r.estado !== 'sorteada' && <button type="button" className="sf-btn sf-btn-primary min-h-11 rounded-[10px]" onClick={() => draw(r)}><Trophy className="size-4" aria-hidden="true" />Sortear</button>}
                <button type="button" aria-label={`Borrar ${r.titulo}`} className="sf-btn sf-btn-ghost min-h-11 rounded-[10px]" onClick={() => { if (confirm(`¿Borrar la rifa “${r.titulo}” y sus números?`)) { deleteRaffle(r.id); refresh() } }}><Trash2 className="size-4" aria-hidden="true" /></button>
              </div>
            </div>
            {open === r.id && (
              <div className="mt-4 grid gap-3">
                {r.estado === 'activa' && (
                  <div className="grid gap-3 sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end">
                    <div><label htmlFor={`rn-${r.id}`} className="sf-label">Número</label><input id={`rn-${r.id}`} inputMode="numeric" value={sell.numero} onChange={(e) => setSell({ ...sell, numero: e.target.value.replace(/\D/g, '') })} className={field} /></div>
                    <div><label htmlFor={`rc-${r.id}`} className="sf-label">Comprador</label><input id={`rc-${r.id}`} value={sell.nombre} onChange={(e) => setSell({ ...sell, nombre: e.target.value })} className={field} /></div>
                    <div><label htmlFor={`rt-${r.id}`} className="sf-label">Teléfono</label><input id={`rt-${r.id}`} inputMode="tel" value={sell.telefono} onChange={(e) => setSell({ ...sell, telefono: e.target.value })} className={field} /></div>
                    <button type="button" className="sf-btn sf-btn-primary min-h-12 rounded-[10px]" onClick={() => addNumber(r)}>Vender número</button>
                  </div>
                )}
                {r.numeros.length === 0 ? <p className="sf-faint">Sin números vendidos todavía.</p> : (
                  <ul className="grid gap-2">
                    {[...r.numeros].sort((a, b) => a.numero - b.numero).map((n) => (
                      <li key={n.numero} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-[0.9rem]" style={{ borderColor: 'var(--sf-rule)' }}>
                        <span><strong>N.º {n.numero}</strong> · {n.nombre}{n.telefono ? ` · ${n.telefono}` : ''} · <span style={{ color: n.estado === 'pagado' ? '#7bd88f' : '#f5c542' }}>{n.estado === 'pagado' ? 'Pagado' : 'Reservado (falta pagar)'}</span></span>
                        <span className="flex gap-2">
                          {n.estado === 'reservado' && <button type="button" className="sf-btn sf-btn-outline min-h-11 rounded-[10px]" onClick={() => { saveRaffle({ ...r, numeros: r.numeros.map((x) => (x.numero === n.numero ? { ...x, estado: 'pagado' } : x)) }); logActivity(user.name, `Marcó pagado el número ${n.numero} de “${r.titulo}”`); refresh() }}>Marcar pagado</button>}
                          {r.estado !== 'sorteada' && <button type="button" className="sf-btn sf-btn-ghost min-h-11 rounded-[10px]" onClick={() => { if (confirm(`¿Liberar el número ${n.numero}?`)) { saveRaffle({ ...r, numeros: r.numeros.filter((x) => x.numero !== n.numero) }); refresh() } }}>Liberar</button>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
