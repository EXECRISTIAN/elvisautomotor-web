'use client'
'use no memo' // Lee datos guardados fuera de React (carpeta datos): sin memorización automática.

import { useEffect, useMemo, useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import { ComboField } from '../components/ComboField'
import {
  PERMISSIONS, ROLES, addCashClose, addCashMove, applyCarChanges, deleteCashMove, listActivity, listCash, listCloses, listSales,
  listSubmissions, logActivity, newId, rolePermissions, saveCar, saveRolePermissions, saveSale, saveSiteSettings, siteSettings, voidSale,
  type LocalCar, type LocalUser, type Sale,
} from '../lib/localStore'

const money = (n: number) => (Number(n) || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const today = () => new Date().toISOString().slice(0, 10)
const monthKey = (iso: string) => iso.slice(0, 7)
const monthLabel = (key: string) => new Date(`${key}-15`).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
const fmtDate = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
const digits = (v: string) => v.replace(/\D/g, '')
const field = 'sf-input mt-2 w-full'
const MEDIOS = ['Efectivo', 'Transferencia', 'Tarjeta de débito', 'Tarjeta de crédito', 'Cheque', 'Crédito bancario']
const CAT_IN = ['Venta de auto', 'Seña', 'Cobro de cuota', 'Gestoría / trámites', 'Otro ingreso']
const CAT_OUT = ['Compra de auto', 'Preparación / taller', 'Sueldos y comisiones', 'Alquiler', 'Servicios', 'Impuestos', 'Publicidad', 'Retiro', 'Otro gasto']
const PAGOS = ['Contado', 'Financiado (banco)', 'Plan canje + contado', 'Plan canje + financiado']

function csv(name: string, rows: (string | number)[][]) {
  const text = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  Object.assign(document.createElement('a'), { href: url, download: `${name}-${today()}.csv` }).click()
  URL.revokeObjectURL(url)
}
function useCars() {
  const [base, setBase] = useState<LocalCar[] | null>(null)
  const [v, setV] = useState(0)
  useEffect(() => { void fetch('/_offline/datos.json').then((r) => r.json()).then((d) => setBase(d.vehicles ?? [])).catch(() => setBase([])) }, [])
  return { cars: useMemo(() => (base ? applyCarChanges(base) : []), [base, v]), refresh: () => setV((x) => x + 1), ready: base !== null }
}
function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="elv-pq-panel !p-4">
      <p className="sf-muted text-[0.78rem] uppercase tracking-[0.06em]">{label}</p>
      <p className="sf-display mt-1 text-[1.35rem] tabular-nums">{value}</p>
      {note && <p className="sf-faint mt-0.5 text-[0.78rem]">{note}</p>}
    </div>
  )
}
function Bars({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex h-40 items-end gap-2" role="img" aria-label={data.map((d) => `${d.label}: ${money(d.value)}`).join(', ')}>
      {data.map((d) => (
        <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t-[4px]" style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, background: 'var(--sf-gold-gradient)' }} title={money(d.value)} />
          <span className="sf-faint truncate text-[0.7rem]">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ---------- Resumen ----------
export function SummarySection() {
  const { cars } = useCars()
  const sales = listSales().filter((s) => !s.anulada)
  const cash = listCash()
  const month = monthKey(new Date().toISOString())
  const monthSales = sales.filter((s) => monthKey(s.fecha) === month)
  const stock = cars.filter((c) => (c.status ?? 'available') !== 'sold')
  const balance = cash.reduce((t, m) => t + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0)
  const monthIn = cash.filter((m) => m.tipo === 'ingreso' && monthKey(m.fecha) === month).reduce((t, m) => t + m.monto, 0)
  const monthOut = cash.filter((m) => m.tipo === 'egreso' && monthKey(m.fecha) === month).reduce((t, m) => t + m.monto, 0)
  const newLeads = listSubmissions().filter((s) => s.status === 'nueva').length
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - (5 - i)); return monthKey(d.toISOString()) })
  return (
    <div className="mt-6 grid gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Vendido este mes" value={money(monthSales.reduce((t, s) => t + s.precio, 0))} note={`${monthSales.length} ${monthSales.length === 1 ? 'auto' : 'autos'}`} />
        <Stat label="Ganancia del mes" value={money(monthSales.reduce((t, s) => t + (s.precio - (s.costo || 0)), 0))} note="Precio de venta menos costo" />
        <Stat label="Saldo de caja" value={money(balance)} note={`Mes: +${money(monthIn)} / −${money(monthOut)}`} />
        <Stat label="Consultas nuevas" value={String(newLeads)} note="Sin responder" />
        <Stat label="Autos en stock" value={String(stock.length)} note={`${stock.filter((c) => c.condition === 'new').length} 0 km · ${stock.filter((c) => c.condition !== 'new').length} usados`} />
        <Stat label="Valor del stock" value={money(stock.reduce((t, c) => t + (Number(c.price) || 0), 0))} note="A precio publicado" />
        <Stat label="Vendido en total" value={money(sales.reduce((t, s) => t + s.precio, 0))} note={`${sales.length} ventas`} />
        <Stat label="Ticket promedio" value={money(sales.length ? sales.reduce((t, s) => t + s.precio, 0) / sales.length : 0)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="elv-pq-panel"><p className="font-bold">Ventas por mes</p><div className="mt-4"><Bars data={months.map((m) => ({ label: monthLabel(m), value: sales.filter((s) => monthKey(s.fecha) === m).reduce((t, s) => t + s.precio, 0) }))} /></div></div>
        <div className="elv-pq-panel"><p className="font-bold">Balance de caja por mes (ingresos − egresos)</p><div className="mt-4"><Bars data={months.map((m) => ({ label: monthLabel(m), value: Math.max(0, cash.filter((c) => monthKey(c.fecha) === m).reduce((t, c) => t + (c.tipo === 'ingreso' ? c.monto : -c.monto), 0)) }))} /></div></div>
      </div>
    </div>
  )
}

// ---------- Ventas ----------
export function SalesSection({ user }: { user: LocalUser }) {
  const { cars, refresh } = useCars()
  const [v, setV] = useState(0)
  const sales = useMemo(() => listSales(), [v])
  const blank = (): Sale => ({ id: newId('V'), fecha: today(), autoId: '', auto: '', cliente: '', telefono: '', dni: '', precio: 0, costo: 0, formaPago: 'Contado', anticipo: 0, canje: 0, vendedor: user.name, notas: '' })
  const [form, setForm] = useState<Sale | null>(null)
  const [cashMedio, setCashMedio] = useState('Efectivo')
  const [error, setError] = useState('')
  const available = cars.filter((c) => (c.status ?? 'available') !== 'sold')
  const label = (c: LocalCar) => `${c.year} ${c.make} ${c.model} ${c.trim ?? ''} · ${c.stockNumber || c.id.slice(0, 6)}`.replace(/\s+/g, ' ')

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!form.autoId || !form.cliente.trim() || !(form.precio > 0)) { setError('Elige el auto, el cliente y el precio final.'); return }
    const car = cars.find((c) => c.id === form.autoId)
    const cobrado = form.formaPago.startsWith('Contado') ? form.precio - form.canje : form.anticipo
    saveSale(form, cobrado > 0 ? { fecha: new Date(`${form.fecha}T12:00:00`).toISOString(), tipo: 'ingreso', categoria: 'Venta de auto', medio: cashMedio, monto: cobrado, detalle: `${form.auto} · ${form.cliente}`, usuario: user.name, ventaId: form.id } : undefined)
    if (car) saveCar({ ...car, status: 'sold' })
    logActivity(user.name, `Registró la venta de ${form.auto} a ${form.cliente} por ${money(form.precio)}`)
    setForm(null); setError(''); setV((x) => x + 1); refresh()
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="sf-btn sf-btn-primary min-h-12 rounded-[10px]" onClick={() => { setError(''); setForm(blank()) }}><Plus className="size-4" aria-hidden="true" />Registrar venta</button>
        <button type="button" className="sf-btn sf-btn-outline min-h-12 rounded-[10px]" disabled={!sales.length} onClick={() => csv('elvis-ventas', [['Fecha', 'Auto', 'Cliente', 'Teléfono', 'DNI', 'Precio', 'Costo', 'Ganancia', 'Forma de pago', 'Anticipo', 'Canje', 'Vendedor', 'Estado'], ...sales.map((s) => [s.fecha, s.auto, s.cliente, s.telefono, s.dni, s.precio, s.costo, s.precio - s.costo, s.formaPago, s.anticipo, s.canje, s.vendedor, s.anulada ? 'Anulada' : 'Vigente'])])}><Download className="size-4" aria-hidden="true" />Exportar a Excel</button>
      </div>
      {form && (
        <form onSubmit={save} className="elv-pq-panel mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3"><label htmlFor="sv-auto" className="sf-label">Auto</label><div className="mt-2"><ComboField id="sv-auto" value={form.auto} onChange={(v) => { const car = available.find((c) => label(c) === v); setForm({ ...form, auto: v, autoId: car?.id ?? '', precio: car ? Number(car.price) || 0 : form.precio }) }} options={available.map(label)} allowCustom={false} placeholder="Elige el auto vendido" /></div></div>
          <div><label htmlFor="sv-fecha" className="sf-label">Fecha</label><input id="sv-fecha" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={field} /></div>
          <div><label htmlFor="sv-cliente" className="sf-label">Cliente</label><input id="sv-cliente" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} className={field} /></div>
          <div><label htmlFor="sv-tel" className="sf-label">Teléfono</label><input id="sv-tel" inputMode="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className={field} /></div>
          <div><label htmlFor="sv-dni" className="sf-label">DNI</label><input id="sv-dni" inputMode="numeric" value={form.dni} onChange={(e) => setForm({ ...form, dni: digits(e.target.value).slice(0, 8) })} className={field} /></div>
          <div><label htmlFor="sv-precio" className="sf-label">Precio final ($)</label><input id="sv-precio" inputMode="numeric" value={form.precio || ''} onChange={(e) => setForm({ ...form, precio: Number(digits(e.target.value)) })} className={field} /></div>
          <div><label htmlFor="sv-costo" className="sf-label">Costo del auto ($) <span className="sf-faint">(para la ganancia)</span></label><input id="sv-costo" inputMode="numeric" value={form.costo || ''} onChange={(e) => setForm({ ...form, costo: Number(digits(e.target.value)) })} className={field} /></div>
          <div><label htmlFor="sv-pago" className="sf-label">Forma de pago</label><div className="mt-2"><ComboField id="sv-pago" value={form.formaPago} onChange={(v) => setForm({ ...form, formaPago: v || 'Contado' })} options={PAGOS} allowCustom={false} /></div></div>
          {form.formaPago.includes('canje') && <div><label htmlFor="sv-canje" className="sf-label">Valor del usado entregado ($)</label><input id="sv-canje" inputMode="numeric" value={form.canje || ''} onChange={(e) => setForm({ ...form, canje: Number(digits(e.target.value)) })} className={field} /></div>}
          {form.formaPago.includes('inanciado') && <div><label htmlFor="sv-anticipo" className="sf-label">Anticipo cobrado ($)</label><input id="sv-anticipo" inputMode="numeric" value={form.anticipo || ''} onChange={(e) => setForm({ ...form, anticipo: Number(digits(e.target.value)) })} className={field} /></div>}
          <div><label htmlFor="sv-medio" className="sf-label">Medio de cobro (va a caja)</label><div className="mt-2"><ComboField id="sv-medio" value={cashMedio} onChange={(v) => setCashMedio(v || 'Efectivo')} options={MEDIOS} allowCustom={false} /></div></div>
          <div><label htmlFor="sv-vend" className="sf-label">Vendedor</label><input id="sv-vend" value={form.vendedor} onChange={(e) => setForm({ ...form, vendedor: e.target.value })} className={field} /></div>
          <div className="sm:col-span-2 lg:col-span-3"><label htmlFor="sv-notas" className="sf-label">Notas</label><textarea id="sv-notas" rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className={field} /></div>
          <p className="sf-muted sm:col-span-2 lg:col-span-3 text-[0.85rem]">Al guardar: el auto queda como vendido en el sitio y lo cobrado se suma a la caja.</p>
          {error && <p role="alert" className="sm:col-span-2 lg:col-span-3 text-[0.9rem]" style={{ color: 'var(--sf-warn, #e0a23a)' }}>{error}</p>}
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3"><button type="submit" className="sf-btn sf-btn-primary min-h-12 rounded-[10px]">Guardar venta</button><button type="button" className="sf-btn sf-btn-ghost min-h-12 rounded-[10px]" onClick={() => setForm(null)}>Cancelar</button></div>
        </form>
      )}
      <ul className="mt-4 grid gap-3">
        {sales.length === 0 && <li className="sf-muted">Todavía no hay ventas registradas.</li>}
        {sales.map((s) => (
          <li key={s.id} className="elv-pq-panel !p-4 flex flex-wrap items-center justify-between gap-3" style={s.anulada ? { opacity: 0.55 } : undefined}>
            <span className="min-w-0"><span className="block font-bold">{s.auto}</span><span className="sf-muted block text-[0.85rem]">{s.fecha} · {s.cliente} · {s.formaPago} · {s.vendedor}{s.anulada ? ' · ANULADA' : ''}</span></span>
            <span className="flex items-center gap-3"><span className="text-right"><span className="block font-bold tabular-nums">{money(s.precio)}</span>{s.costo > 0 && <span className="sf-faint block text-[0.8rem] tabular-nums">Ganancia {money(s.precio - s.costo)}</span>}</span>
              {!s.anulada && <button type="button" className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]" onClick={() => { if (window.confirm('¿Anular esta venta? El movimiento de caja queda; puedes cargar un egreso si devolviste dinero.')) { voidSale(s.id); logActivity(user.name, `Anuló la venta de ${s.auto}`); setV((x) => x + 1) } }}>Anular</button>}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- Caja ----------
export function CashSection({ user }: { user: LocalUser }) {
  const [v, setV] = useState(0)
  const moves = useMemo(() => listCash(), [v])
  const closes = useMemo(() => listCloses(), [v])
  const [day, setDay] = useState(today())
  const [form, setForm] = useState({ tipo: 'ingreso' as 'ingreso' | 'egreso', categoria: '', medio: 'Efectivo', monto: '', detalle: '' })
  const [count, setCount] = useState('')
  const [error, setError] = useState('')
  const balance = moves.reduce((t, m) => t + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0)
  const dayMoves = moves.filter((m) => m.fecha.slice(0, 10) === day)
  const dayIn = dayMoves.filter((m) => m.tipo === 'ingreso').reduce((t, m) => t + m.monto, 0)
  const dayOut = dayMoves.filter((m) => m.tipo === 'egreso').reduce((t, m) => t + m.monto, 0)
  const cashOnly = moves.filter((m) => m.medio === 'Efectivo').reduce((t, m) => t + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0)

  function add(e: React.FormEvent) {
    e.preventDefault()
    const monto = Number(digits(form.monto))
    if (!(monto > 0) || !form.categoria) { setError('Indica la categoría y el monto.'); return }
    addCashMove({ fecha: new Date(`${day}T${new Date().toTimeString().slice(0, 8)}`).toISOString(), tipo: form.tipo, categoria: form.categoria, medio: form.medio, monto, detalle: form.detalle, usuario: user.name })
    logActivity(user.name, `Cargó un ${form.tipo} de ${money(monto)} (${form.categoria})`)
    setForm({ ...form, monto: '', detalle: '' }); setError(''); setV((x) => x + 1)
  }
  function close() {
    const contado = Number(digits(count))
    addCashClose({ fecha: new Date().toISOString(), esperado: cashOnly, contado, diferencia: contado - cashOnly, usuario: user.name, nota: '' })
    logActivity(user.name, `Cerró la caja: esperado ${money(cashOnly)}, contado ${money(contado)}`)
    setCount(''); setV((x) => x + 1)
  }

  return (
    <div className="mt-6 grid gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Saldo total" value={money(balance)} note="Todos los medios" />
        <Stat label="Efectivo en caja" value={money(cashOnly)} note="Según movimientos" />
        <Stat label={`Ingresos ${day === today() ? 'de hoy' : day}`} value={money(dayIn)} />
        <Stat label={`Egresos ${day === today() ? 'de hoy' : day}`} value={money(dayOut)} />
      </div>
      <form onSubmit={add} className="elv-pq-panel grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <p className="font-bold sm:col-span-2 lg:col-span-3">Nuevo movimiento</p>
        <div><span className="sf-label">Tipo</span><div className="sf-track sf-track-choices mt-2">{(['ingreso', 'egreso'] as const).map((t) => <button key={t} type="button" className="sf-pill min-h-11" aria-pressed={form.tipo === t} onClick={() => setForm({ ...form, tipo: t, categoria: '' })}>{t === 'ingreso' ? 'Ingreso' : 'Egreso'}</button>)}</div></div>
        <div><label htmlFor="cj-cat" className="sf-label">Categoría</label><div className="mt-2"><ComboField id="cj-cat" value={form.categoria} onChange={(v) => setForm({ ...form, categoria: v })} options={form.tipo === 'ingreso' ? CAT_IN : CAT_OUT} placeholder="Elige o escribe" /></div></div>
        <div><label htmlFor="cj-medio" className="sf-label">Medio</label><div className="mt-2"><ComboField id="cj-medio" value={form.medio} onChange={(v) => setForm({ ...form, medio: v || 'Efectivo' })} options={MEDIOS} allowCustom={false} /></div></div>
        <div><label htmlFor="cj-monto" className="sf-label">Monto ($)</label><input id="cj-monto" inputMode="numeric" value={form.monto} onChange={(e) => setForm({ ...form, monto: digits(e.target.value) })} className={field} /></div>
        <div className="sm:col-span-1 lg:col-span-2"><label htmlFor="cj-det" className="sf-label">Detalle</label><input id="cj-det" value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} className={field} placeholder="Ej.: Seña Cronos, factura de luz…" /></div>
        {error && <p role="alert" className="sm:col-span-2 lg:col-span-3 text-[0.9rem]" style={{ color: 'var(--sf-warn, #e0a23a)' }}>{error}</p>}
        <div className="sm:col-span-2 lg:col-span-3"><button type="submit" className="sf-btn sf-btn-primary min-h-12 rounded-[10px]"><Plus className="size-4" aria-hidden="true" />Agregar movimiento</button></div>
      </form>
      <div className="elv-pq-panel grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div><p className="font-bold">Cierre de caja (arqueo de efectivo)</p><p className="sf-muted text-[0.85rem]">Cuenta el efectivo físico y anótalo: se guarda la diferencia con lo esperado ({money(cashOnly)}).</p>
          <label htmlFor="cj-count" className="sf-label mt-3 block">Efectivo contado ($)</label><input id="cj-count" inputMode="numeric" value={count} onChange={(e) => setCount(digits(e.target.value))} className={field} /></div>
        <button type="button" className="sf-btn sf-btn-primary min-h-12 rounded-[10px]" disabled={!count} onClick={close}>Cerrar caja</button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div><label htmlFor="cj-day" className="sf-label">Ver movimientos del día</label><input id="cj-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} className={field} /></div>
        <button type="button" className="sf-btn sf-btn-outline min-h-12 rounded-[10px]" disabled={!moves.length} onClick={() => csv('elvis-caja', [['Fecha', 'Tipo', 'Categoría', 'Medio', 'Monto', 'Detalle', 'Usuario'], ...moves.map((m) => [fmtDate(m.fecha), m.tipo, m.categoria, m.medio, m.tipo === 'ingreso' ? m.monto : -m.monto, m.detalle, m.usuario])])}><Download className="size-4" aria-hidden="true" />Exportar caja a Excel</button>
      </div>
      <ul className="grid gap-2">
        {dayMoves.length === 0 && <li className="sf-muted">Sin movimientos ese día.</li>}
        {dayMoves.map((m) => (
          <li key={m.id} className="elv-pq-panel !p-3 flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0"><span className="block font-semibold">{m.categoria}{m.detalle ? ` · ${m.detalle}` : ''}</span><span className="sf-muted block text-[0.8rem]">{fmtDate(m.fecha)} · {m.medio} · {m.usuario}</span></span>
            <span className="flex items-center gap-2"><span className="font-bold tabular-nums" style={{ color: m.tipo === 'ingreso' ? '#3fb37f' : '#e0703a' }}>{m.tipo === 'ingreso' ? '+' : '−'}{money(m.monto)}</span>
              {!m.ventaId && <button type="button" className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]" aria-label="Borrar movimiento" onClick={() => { if (window.confirm('¿Borrar este movimiento?')) { deleteCashMove(m.id); logActivity(user.name, `Borró un ${m.tipo} de ${money(m.monto)}`); setV((x) => x + 1) } }}><Trash2 className="size-4" aria-hidden="true" /></button>}</span>
          </li>
        ))}
      </ul>
      {closes.length > 0 && (
        <div className="elv-pq-panel"><p className="font-bold">Cierres anteriores</p>
          <ul className="mt-2 grid gap-1 text-[0.9rem]">{closes.slice(0, 15).map((c) => <li key={c.id} className="flex flex-wrap justify-between gap-2"><span>{fmtDate(c.fecha)} · {c.usuario}</span><span className="tabular-nums">Esperado {money(c.esperado)} · Contado {money(c.contado)} · <strong style={{ color: c.diferencia === 0 ? '#3fb37f' : '#e0703a' }}>Dif. {money(c.diferencia)}</strong></span></li>)}</ul>
        </div>
      )}
    </div>
  )
}

// ---------- Clientes ----------
export function ClientsSection() {
  const [q, setQ] = useState('')
  const clients = useMemo(() => {
    const map = new Map<string, { nombre: string; telefono: string; email: string; dni: string; consultas: number; compras: number; ultima: string }>()
    const key = (tel: string, email: string, nombre: string) => (digits(tel) || email || nombre).toLowerCase()
    for (const s of listSubmissions()) {
      const d = s.data as Record<string, string>
      const nombre = String(d.fullName || [d.firstName, d.lastName].filter(Boolean).join(' ') || 'Sin nombre')
      const k = key(String(d.phone || ''), String(d.email || ''), nombre)
      const c = map.get(k) ?? { nombre, telefono: String(d.phone || ''), email: String(d.email || ''), dni: String(d.dni || ''), consultas: 0, compras: 0, ultima: s.createdAt }
      c.consultas += 1; if (s.createdAt > c.ultima) c.ultima = s.createdAt
      map.set(k, c)
    }
    for (const s of listSales().filter((x) => !x.anulada)) {
      const k = key(s.telefono, '', s.cliente)
      const c = map.get(k) ?? { nombre: s.cliente, telefono: s.telefono, email: '', dni: s.dni, consultas: 0, compras: 0, ultima: s.fecha }
      c.compras += 1; map.set(k, c)
    }
    return [...map.values()].sort((a, b) => b.ultima.localeCompare(a.ultima))
  }, [])
  const shown = clients.filter((c) => !q || `${c.nombre} ${c.telefono} ${c.email} ${c.dni}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 sm:max-w-xs"><label htmlFor="cl-q" className="sf-label">Buscar</label><input id="cl-q" value={q} onChange={(e) => setQ(e.target.value)} className={field} placeholder="Nombre, teléfono, email o DNI" /></div>
        <button type="button" className="sf-btn sf-btn-outline min-h-12 rounded-[10px]" disabled={!clients.length} onClick={() => csv('elvis-clientes', [['Nombre', 'Teléfono', 'Email', 'DNI', 'Consultas', 'Compras'], ...clients.map((c) => [c.nombre, c.telefono, c.email, c.dni, c.consultas, c.compras])])}><Download className="size-4" aria-hidden="true" />Exportar a Excel</button>
      </div>
      <ul className="mt-4 grid gap-2">
        {shown.length === 0 && <li className="sf-muted">Todavía no hay clientes: aparecen cuando llegan consultas o registras ventas.</li>}
        {shown.map((c) => (
          <li key={`${c.nombre}${c.telefono}`} className="elv-pq-panel !p-3 flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0"><span className="block font-semibold">{c.nombre}</span><span className="sf-muted block text-[0.8rem]">{[c.telefono, c.email, c.dni && `DNI ${c.dni}`].filter(Boolean).join(' · ')}</span></span>
            <span className="flex items-center gap-2"><span className="sf-chip">{c.consultas} consultas</span>{c.compras > 0 && <span className="sf-chip">{c.compras} compras</span>}
              {c.telefono && <a className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]" href={`https://wa.me/549${digits(c.telefono).replace(/^0/, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- Sitio (contenido y diseño) ----------
const SITE_FIELDS: Array<[string, string, string, boolean?]> = [
  ['aviso', 'Aviso destacado arriba de todo (vacío = sin aviso)', 'Ej.: Este sábado abrimos de 9 a 13 h'],
  ['kicker', 'Frase corta de la portada', 'Calidad • Confianza • Respaldo'],
  ['heroTitulo', 'Título de la portada', 'Tu próximo auto, más cerca.'],
  ['heroTexto', 'Texto de la portada', 'Compra y venta de usados y 0 km desde 2009…', true],
  ['nosotrosIntro', 'Texto de "Nosotros"', 'Somos una empresa de compra y venta de autos…', true],
  ['telefono', 'Teléfono', '(011) 4259-1365'],
  ['whatsapp', 'WhatsApp (con código de país)', '5491127235886'],
  ['email', 'Email', 'elvisautomotores@gmail.com'],
  ['direccion', 'Dirección', 'Andrés Baranda 2134'],
  ['localidad', 'Localidad', 'Quilmes, Provincia de Buenos Aires, Argentina'],
  ['horarioSemana', 'Horario lunes a viernes', '9 a 13 h'],
  ['horarioSabado', 'Horario sábados', 'Cerrado'],
]
export function SiteSection({ user }: { user: LocalUser }) {
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...siteSettings() }))
  const [saved, setSaved] = useState(false)
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    saveSiteSettings(values); logActivity(user.name, 'Editó el contenido y diseño del sitio'); setSaved(true)
  }
  return (
    <form onSubmit={save} className="mt-6 grid gap-4">
      <p className="sf-muted text-[0.9rem]">Lo que cambies acá se ve en el sitio al recargar la página. Deja un campo vacío para usar el texto original.</p>
      <div className="elv-pq-panel grid gap-4 sm:grid-cols-2">
        <p className="font-bold sm:col-span-2">Diseño</p>
        <div><label htmlFor="st-acc" className="sf-label">Color principal (botones y detalles)</label><div className="mt-2 flex items-center gap-3"><input id="st-acc" type="color" value={values.colorAcento || '#d8b25a'} onChange={(e) => { setSaved(false); setValues({ ...values, colorAcento: e.target.value }) }} className="h-12 w-20 cursor-pointer rounded-[8px] border" /><button type="button" className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]" onClick={() => { setSaved(false); setValues({ ...values, colorAcento: '' }) }}>Usar el dorado original</button></div></div>
        <div><label htmlFor="st-bg" className="sf-label">Color de fondo de las tarjetas</label><div className="mt-2 flex items-center gap-3"><input id="st-bg" type="color" value={values.colorFondo || '#111111'} onChange={(e) => { setSaved(false); setValues({ ...values, colorFondo: e.target.value }) }} className="h-12 w-20 cursor-pointer rounded-[8px] border" /><button type="button" className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]" onClick={() => { setSaved(false); setValues({ ...values, colorFondo: '' }) }}>Original</button></div></div>
      </div>
      <div className="elv-pq-panel grid gap-4 sm:grid-cols-2">
        <p className="font-bold sm:col-span-2">Textos e información</p>
        {SITE_FIELDS.map(([key, label, placeholder, long]) => (
          <div key={key} className={long ? 'sm:col-span-2' : ''}>
            <label htmlFor={`st-${key}`} className="sf-label">{label}</label>
            {long ? <textarea id={`st-${key}`} rows={3} value={values[key] || ''} onChange={(e) => { setSaved(false); setValues({ ...values, [key]: e.target.value }) }} className={field} placeholder={placeholder} />
              : <input id={`st-${key}`} value={values[key] || ''} onChange={(e) => { setSaved(false); setValues({ ...values, [key]: e.target.value }) }} className={field} placeholder={placeholder} />}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3"><button type="submit" className="sf-btn sf-btn-primary min-h-12 rounded-[10px]">Guardar cambios del sitio</button><a href="/" target="_blank" rel="noreferrer" className="sf-btn sf-btn-ghost min-h-12 rounded-[10px]">Ver el sitio</a>{saved && <span role="status" className="sf-muted">Guardado.</span>}</div>
    </form>
  )
}

// ---------- Permisos por rol ----------
export function PermissionsSection({ user }: { user: LocalUser }) {
  const [perms, setPerms] = useState(() => rolePermissions())
  const [saved, setSaved] = useState(false)
  const toggle = (role: string, perm: string) => {
    if (role === 'Administrador') return
    setSaved(false)
    setPerms((p) => ({ ...p, [role]: p[role]?.includes(perm) ? p[role].filter((x) => x !== perm) : [...(p[role] ?? []), perm] }))
  }
  return (
    <div className="mt-6">
      <p className="sf-muted text-[0.9rem]">Marca qué puede hacer cada rol. El Administrador puede todo.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[0.85rem]">
          <thead><tr><th className="p-2 text-left">Permiso</th>{ROLES.map((r) => <th key={r} className="p-2 text-center">{r}</th>)}</tr></thead>
          <tbody>{PERMISSIONS.map(([k, label]) => (
            <tr key={k} className="border-t" style={{ borderColor: 'var(--sf-rule)' }}><td className="p-2">{label}</td>
              {ROLES.map((r) => <td key={r} className="p-2 text-center"><input type="checkbox" className="size-5" aria-label={`${r}: ${label}`} checked={Boolean(perms[r]?.includes(k))} disabled={r === 'Administrador'} onChange={() => toggle(r, k)} /></td>)}</tr>
          ))}</tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center gap-3"><button type="button" className="sf-btn sf-btn-primary min-h-12 rounded-[10px]" onClick={() => { saveRolePermissions(perms); logActivity(user.name, 'Cambió los permisos de los roles'); setSaved(true) }}>Guardar permisos</button>{saved && <span role="status" className="sf-muted">Guardado.</span>}</div>
    </div>
  )
}

// ---------- Actividad ----------
export function ActivitySection() {
  const items = listActivity()
  return (
    <div className="mt-6">
      <button type="button" className="sf-btn sf-btn-outline min-h-12 rounded-[10px]" disabled={!items.length} onClick={() => csv('elvis-actividad', [['Fecha', 'Usuario', 'Acción'], ...items.map((a) => [fmtDate(a.fecha), a.usuario, a.accion])])}><Download className="size-4" aria-hidden="true" />Exportar a Excel</button>
      <ul className="mt-4 grid gap-1 text-[0.9rem]">
        {items.length === 0 && <li className="sf-muted">Sin actividad registrada todavía.</li>}
        {items.slice(0, 300).map((a) => <li key={a.id} className="flex flex-wrap gap-x-3 border-b py-2" style={{ borderColor: 'var(--sf-rule)' }}><span className="sf-faint tabular-nums">{fmtDate(a.fecha)}</span><span className="font-semibold">{a.usuario}</span><span>{a.accion}</span></li>)}
      </ul>
    </div>
  )
}
