'use client'
'use no memo' // Lee datos guardados fuera de React (carpeta datos): sin memorización automática.

import { useEffect, useMemo, useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import { ComboField } from '../components/ComboField'
import {
  PERMISSIONS, ROLES, addCashClose, analytics, addCashMove, applyCarChanges, deleteCashMove, listActivity, listCash, listCloses, listSales,
  listSubmissions, logActivity, newId, exportAll, importAll, rolePermissions, saveCar, saveRolePermissions, saveSale, saveSiteSettings, siteSettings, voidSale,
  listClients, saveClient, clientName, saveFile,
  type Client, type LocalCar, type LocalUser, type Sale,
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
function Stat({ label, value, note, onClick }: { label: string; value: string; note?: string; onClick?: () => void }) {
  const body = (
    <>
      <p className="sf-muted text-[0.78rem] uppercase tracking-[0.06em]">{label}</p>
      <p className="sf-display mt-1 text-[1.35rem] tabular-nums">{value}</p>
      {note && <p className="sf-faint mt-0.5 text-[0.78rem]">{note}</p>}
    </>
  )
  return onClick
    ? <button type="button" onClick={onClick} className="elv-pq-panel !p-4 text-left transition-colors hover:border-[var(--sf-accent)]" aria-label={`${label}: ${value}. Ver detalle`}>{body}</button>
    : <div className="elv-pq-panel !p-4">{body}</div>
}
function Bars({ data, fmt = money }: { data: Array<{ label: string; value: number }>; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex h-40 items-end gap-2" role="img" aria-label={data.map((d) => `${d.label}: ${fmt(d.value)}`).join(', ')}>
      {data.map((d) => (
        <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t-[4px]" style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, background: 'var(--sf-gold-gradient)' }} title={fmt(d.value)} />
          <span className="sf-faint truncate text-[0.7rem]">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ---------- Resumen ----------
export function SummarySection({ go }: { go?: (tab: string, filter?: string) => void }) {
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
        <Stat onClick={go && (() => go('ventas'))} label="Vendido este mes" value={money(monthSales.reduce((t, s) => t + s.precio, 0))} note={`${monthSales.length} ${monthSales.length === 1 ? 'auto' : 'autos'}`} />
        <Stat onClick={go && (() => go('ventas'))} label="Ganancia del mes" value={money(monthSales.reduce((t, s) => t + (s.precio - (s.costo || 0)), 0))} note="Precio de venta menos costo" />
        <Stat onClick={go && (() => go('caja'))} label="Saldo de caja" value={money(balance)} note={`Mes: +${money(monthIn)} / −${money(monthOut)}`} />
        <Stat onClick={go && (() => go('consultas', 'nueva'))} label="Consultas nuevas" value={String(newLeads)} note="Sin responder" />
        <Stat onClick={go && (() => go('autos'))} label="Autos en stock" value={String(stock.length)} note={`${stock.filter((c) => c.condition === 'new').length} 0 km · ${stock.filter((c) => c.condition !== 'new').length} usados`} />
        <Stat onClick={go && (() => go('autos'))} label="Valor del stock" value={money(stock.reduce((t, c) => t + (Number(c.price) || 0), 0))} note="A precio publicado" />
        <Stat onClick={go && (() => go('ventas'))} label="Vendido en total" value={money(sales.reduce((t, s) => t + s.precio, 0))} note={`${sales.length} ventas`} />
        <Stat onClick={go && (() => go('ventas'))} label="Ticket promedio" value={money(sales.length ? sales.reduce((t, s) => t + s.precio, 0) / sales.length : 0)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="elv-pq-panel"><p className="font-bold">Ventas por mes</p><div className="mt-4"><Bars data={months.map((m) => ({ label: monthLabel(m), value: sales.filter((s) => monthKey(s.fecha) === m).reduce((t, s) => t + s.precio, 0) }))} /></div></div>
        <div className="elv-pq-panel"><p className="font-bold">Balance de caja por mes (ingresos − egresos)</p><div className="mt-4"><Bars data={months.map((m) => ({ label: monthLabel(m), value: Math.max(0, cash.filter((c) => monthKey(c.fecha) === m).reduce((t, c) => t + (c.tipo === 'ingreso' ? c.monto : -c.monto), 0)) }))} /></div></div>
      </div>
      <TrafficPanel />
    </div>
  )
}

function TrafficPanel() {
  const a = analytics(7)
  const names: Record<string, string> = { '/': 'Inicio', '/inventory': 'Inventario', '/inventory/(auto)': 'Fichas de autos', '/ofertas': 'Ofertas', '/financing': 'Financiación', '/precalificador': 'Precalificador', '/trade-in': 'Vende tu auto', '/nosotros': 'Nosotros', '/contact': 'Contacto', '/test-drive': 'Prueba de manejo', '/compare': 'Comparar' }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="elv-pq-panel">
        <p className="font-bold">Visitas a la web (últimos 7 días)</p>
        <p className="sf-muted text-[0.85rem]">{a.total} visitas · {a.leads} consultas · conversión {a.total ? ((a.leads / a.total) * 100).toFixed(1) : '0'}%{a.medianLoad != null ? ` · carga típica ${(a.medianLoad / 1000).toFixed(1)} s` : ''}</p>
        <div className="mt-4"><Bars data={a.perDay.map((d) => ({ label: d.day.slice(8) + '/' + d.day.slice(5, 7), value: d.total }))} fmt={(n) => `${n} visitas`} /></div>
      </div>
      <div className="elv-pq-panel">
        <p className="font-bold">Páginas más vistas</p>
        {a.pages.length ? (
          <ol className="mt-3 grid gap-2 text-[0.9rem]">
            {a.pages.slice(0, 8).map(([page, n]) => (
              <li key={page} className="flex justify-between gap-3 border-b pb-1" style={{ borderColor: 'var(--sf-rule)' }}><span className="truncate">{names[page] ?? page}</span><strong>{n}</strong></li>
            ))}
          </ol>
        ) : <p className="sf-faint mt-3">Todavía no hay visitas registradas.</p>}
        <p className="sf-faint mt-3 text-[0.75rem]">Se cuenta en este equipo, sin servicios externos. Las visitas al panel no se cuentan.</p>
      </div>
    </div>
  )
}

// ---------- Comprobante de venta (no fiscal) ----------
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
function printReceipt(sale: Sale) {
  const site = siteSettings()
  const win = window.open('', '_blank', 'width=820,height=1000')
  if (!win) { window.alert('Permite las ventanas emergentes para imprimir el comprobante.'); return }
  const row = (label: string, value: string) => `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante ${esc(sale.id)}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px;max-width:720px}h1{font-size:22px;margin:0}h2{font-size:15px;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.06em}
.head{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:12px}.muted{color:#555;font-size:13px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:7px 4px;border-bottom:1px solid #ddd;font-size:14px}th{width:38%;color:#444;font-weight:600}
.total{font-size:20px;font-weight:700}.firmas{display:flex;gap:48px;margin-top:64px}.firmas div{flex:1;border-top:1px solid #111;padding-top:6px;text-align:center;font-size:13px}.nota{margin-top:28px;font-size:12px;color:#555}@media print{button{display:none}body{margin:12mm}}</style></head><body>
<div class="head"><div><h1>Elvis Automotores S.R.L.</h1><div class="muted">${esc(site.direccion || 'Andrés Baranda 2134')}, ${esc(site.localidad || 'Quilmes, Provincia de Buenos Aires, Argentina')}<br>Tel. ${esc(site.telefono || '(011) 4259-1365')}</div></div>
<div style="text-align:right"><strong>Comprobante de venta</strong><div class="muted">N.º ${esc(sale.id)}<br>Fecha: ${esc(sale.fecha.split("-").reverse().join("/"))}</div></div></div>
<h2>Cliente</h2><table>${row('Nombre', sale.cliente)}${sale.dni ? row('DNI', sale.dni) : ''}${sale.telefono ? row('Teléfono', sale.telefono) : ''}</table>
<h2>Vehículo</h2><table>${row('Unidad', sale.auto)}</table>
<h2>Operación</h2><table>${row('Forma de pago', sale.formaPago)}${sale.canje ? row('Usado entregado (valor)', money(sale.canje)) : ''}${sale.anticipo ? row('Anticipo', money(sale.anticipo)) : ''}${row('Vendedor', sale.vendedor)}${sale.notas ? row('Notas', sale.notas) : ''}
<tr><th>Precio total</th><td class="total">${esc(money(sale.precio))}</td></tr></table>
<div class="firmas"><div>Firma del cliente</div><div>Por Elvis Automotores</div></div>
<p class="nota">Documento interno, no válido como factura. La transferencia del dominio se realiza ante el Registro de la Propiedad Automotor.</p>
<p><button onclick="window.print()" style="padding:10px 18px;font-size:15px">Imprimir o guardar en PDF</button></p>
<script>setTimeout(function(){window.print()},300)</script></body></html>`)
  win.document.close()
}

// ---------- Ventas ----------
const mailto = (to: string, subject: string, body: string) => `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
function registrationMail(c: Client) {
  const site = siteSettings()
  return mailto(c.email, 'Bienvenido a Elvis Automotores', `Hola ${c.nombre}:\n\nTe registramos como cliente de Elvis Automotores.\n\nPara ver tus compras y tu contrato, entra en la web a Clientes → Crear usuario con tu DNI y este email.\n\nTus datos: ${clientName(c)} · DNI ${c.dni} · ${c.telefono || 'sin teléfono'}\n\nAnte cualquier consulta escríbenos o llámanos${site.telefono ? ` al ${site.telefono}` : ''}.\n\nGracias por elegirnos.\nElvis Automotores`)
}
function contractMail(s: Sale) {
  return mailto(s.email ?? '', `Contrato de venta · ${s.auto}`, `Hola ${s.cliente}:\n\nTe enviamos el contrato de compraventa del ${s.auto} (fecha ${s.fecha.split('-').reverse().join('/')}, precio ${money(s.precio)}).\n\n${s.contrato ? `Va adjunto el archivo “${s.contrato.nombre}”.` : 'Va adjunto el contrato.'}\n\nGracias por tu compra.\nElvis Automotores`)
}
function SaleDone({ sale, client, registered, onClose }: { sale: Sale; client: Client; registered: boolean; onClose: () => void }) {
  return (
    <div className="elv-pq-panel mt-4 grid gap-3" role="status">
      <p className="font-bold">Venta guardada: {sale.auto} a {clientName(client)}.</p>
      <p className="sf-muted text-[0.9rem]">Los mails se abren en tu programa de correo, ya escritos y dirigidos a {client.email}.{sale.contrato ? ' Para el contrato, descárgalo y adjúntalo al mail antes de enviarlo.' : ''}</p>
      <div className="flex flex-wrap gap-2">
        {registered && <a className="sf-btn sf-btn-primary min-h-12 rounded-[10px]" href={registrationMail(client)}>Enviar mail de registro</a>}
        <a className="sf-btn sf-btn-primary min-h-12 rounded-[10px]" href={contractMail(sale)}>Enviar mail con el contrato</a>
        {sale.contrato && <a className="sf-btn sf-btn-outline min-h-12 rounded-[10px]" href={sale.contrato.url} download={sale.contrato.nombre} target="_blank" rel="noreferrer"><Download className="size-4" aria-hidden="true" />Descargar contrato</a>}
        <button type="button" className="sf-btn sf-btn-ghost min-h-12 rounded-[10px]" onClick={onClose}>Listo</button>
      </div>
    </div>
  )
}

export function SalesSection({ user }: { user: LocalUser }) {
  const { cars, refresh } = useCars()
  const [v, setV] = useState(0)
  const sales = useMemo(() => listSales(), [v])
  const blank = (): Sale => ({ id: newId('V'), fecha: today(), autoId: '', auto: '', cliente: '', telefono: '', dni: '', precio: 0, costo: 0, formaPago: 'Contado', anticipo: 0, canje: 0, vendedor: user.name, notas: '' })
  const [form, setForm] = useState<Sale | null>(null)
  const [cashMedio, setCashMedio] = useState('Efectivo')
  const [error, setError] = useState('')
  const [newClient, setNewClient] = useState<Client | null>(null)
  const [contract, setContract] = useState<File | null>(null)
  const [done, setDone] = useState<{ sale: Sale; client: Client; registered: boolean } | null>(null)
  const clients = listClients()
  const clientLabel = (c: Client) => `${clientName(c)}${c.dni ? ` · DNI ${c.dni}` : ''}`
  const emptyClient = (): Client => ({ id: newId('CLI').toLowerCase(), nombre: '', apellido: '', dni: '', telefono: '', email: '', domicilio: '', localidad: '', creado: new Date().toISOString() })
  const available = cars.filter((c) => (c.status ?? 'available') !== 'sold')
  const label = (c: LocalCar) => `${c.year} ${c.make} ${c.model} ${c.trim ?? ''} · ${c.stockNumber || c.id.slice(0, 6)}`.replace(/\s+/g, ' ')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    let client = clients.find((c) => c.id === form.clienteId) ?? null
    const registered = Boolean(newClient)
    if (newClient) {
      if (!newClient.nombre.trim() || !newClient.apellido.trim() || digits(newClient.dni).length < 7 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newClient.email.trim())) { setError('Para registrar al cliente completa nombre, apellido, DNI y un email válido.'); return }
      if (clients.some((c) => c.dni && c.dni === digits(newClient.dni))) { setError('Ya hay un cliente registrado con ese DNI: elígelo de la lista.'); return }
      client = { ...newClient, dni: digits(newClient.dni), email: newClient.email.trim() }
    }
    if (!form.autoId || !client || !(form.precio > 0)) { setError('Elige el auto, el cliente registrado (o regístralo) y el precio final.'); return }
    let contrato = form.contrato
    if (contract) { try { contrato = await saveFile(contract) } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar el contrato.'); return } }
    if (registered) { saveClient(client); logActivity(user.name, `Registró al cliente ${clientName(client)}`) }
    form.clienteId = client.id; form.cliente = clientName(client); form.telefono = client.telefono; form.dni = client.dni; form.email = client.email; form.contrato = contrato
    const car = cars.find((c) => c.id === form.autoId)
    const cobrado = form.formaPago.startsWith('Contado') ? form.precio - form.canje : form.anticipo
    saveSale(form, cobrado > 0 ? { fecha: new Date(`${form.fecha}T12:00:00`).toISOString(), tipo: 'ingreso', categoria: 'Venta de auto', medio: cashMedio, monto: cobrado, detalle: `${form.auto} · ${form.cliente}`, usuario: user.name, ventaId: form.id } : undefined)
    if (car) saveCar({ ...car, status: 'sold' })
    logActivity(user.name, `Registró la venta de ${form.auto} a ${form.cliente} por ${money(form.precio)}`)
    setDone({ sale: { ...form }, client, registered })
    setForm(null); setNewClient(null); setContract(null); setError(''); setV((x) => x + 1); refresh()
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="sf-btn sf-btn-primary min-h-12 rounded-[10px]" onClick={() => { setError(''); setDone(null); setNewClient(null); setContract(null); setForm(blank()) }}><Plus className="size-4" aria-hidden="true" />Registrar venta</button>
        <button type="button" className="sf-btn sf-btn-outline min-h-12 rounded-[10px]" disabled={!sales.length} onClick={() => csv('elvis-ventas', [['Fecha', 'Auto', 'Cliente', 'Teléfono', 'DNI', 'Precio', 'Costo', 'Ganancia', 'Forma de pago', 'Anticipo', 'Canje', 'Vendedor', 'Estado'], ...sales.map((s) => [s.fecha, s.auto, s.cliente, s.telefono, s.dni, s.precio, s.costo, s.precio - s.costo, s.formaPago, s.anticipo, s.canje, s.vendedor, s.anulada ? 'Anulada' : 'Vigente'])])}><Download className="size-4" aria-hidden="true" />Exportar a Excel</button>
      </div>
      {form && (
        <form onSubmit={save} className="elv-pq-panel mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3"><label htmlFor="sv-auto" className="sf-label">Auto</label><div className="mt-2"><ComboField id="sv-auto" value={form.auto} onChange={(v) => { const car = available.find((c) => label(c) === v); setForm({ ...form, auto: v, autoId: car?.id ?? '', precio: car ? Number(car.price) || 0 : form.precio }) }} options={available.map(label)} allowCustom={false} placeholder="Elige el auto vendido" /></div></div>
          <div><label htmlFor="sv-fecha" className="sf-label">Fecha</label><input id="sv-fecha" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={field} /></div>
          <div className="sm:col-span-2 lg:col-span-2">
            <label htmlFor="sv-cliente" className="sf-label">Cliente registrado</label>
            {newClient ? <p className="sf-muted mt-2 text-[0.9rem]">Se registra un cliente nuevo (completa sus datos abajo).</p> : (
              <div className="mt-2"><ComboField id="sv-cliente" value={(() => { const c = clients.find((x) => x.id === form.clienteId); return c ? clientLabel(c) : '' })()} onChange={(v) => setForm({ ...form, clienteId: clients.find((c) => clientLabel(c) === v)?.id ?? '' })} options={clients.map(clientLabel)} allowCustom={false} placeholder={clients.length ? 'Busca por nombre o DNI' : 'Todavía no hay clientes registrados'} emptyText="No está registrado: usa “Registrar cliente nuevo”" /></div>
            )}
            <button type="button" className="sf-btn sf-btn-outline mt-2 min-h-11 rounded-[10px]" onClick={() => { setNewClient(newClient ? null : emptyClient()); setForm({ ...form, clienteId: '' }) }}>{newClient ? 'Elegir un cliente registrado' : 'Registrar cliente nuevo'}</button>
          </div>
          {newClient && (
            <fieldset className="grid gap-4 rounded-[10px] border p-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3" style={{ borderColor: 'var(--sf-rule)' }}>
              <legend className="sf-label px-1">Registro del cliente</legend>
              <div><label htmlFor="nc-nombre" className="sf-label">Nombre</label><input id="nc-nombre" value={newClient.nombre} onChange={(e) => setNewClient({ ...newClient, nombre: e.target.value })} className={field} autoComplete="off" /></div>
              <div><label htmlFor="nc-apellido" className="sf-label">Apellido</label><input id="nc-apellido" value={newClient.apellido} onChange={(e) => setNewClient({ ...newClient, apellido: e.target.value })} className={field} autoComplete="off" /></div>
              <div><label htmlFor="nc-dni" className="sf-label">DNI</label><input id="nc-dni" inputMode="numeric" value={newClient.dni} onChange={(e) => setNewClient({ ...newClient, dni: digits(e.target.value).slice(0, 8) })} className={field} /></div>
              <div><label htmlFor="nc-email" className="sf-label">Email</label><input id="nc-email" type="email" inputMode="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} className={field} /></div>
              <div><label htmlFor="nc-tel" className="sf-label">Teléfono</label><input id="nc-tel" inputMode="tel" value={newClient.telefono} onChange={(e) => setNewClient({ ...newClient, telefono: e.target.value })} className={field} /></div>
              <div><label htmlFor="nc-dom" className="sf-label">Domicilio</label><input id="nc-dom" value={newClient.domicilio} onChange={(e) => setNewClient({ ...newClient, domicilio: e.target.value })} className={field} /></div>
              <div><label htmlFor="nc-loc" className="sf-label">Localidad</label><input id="nc-loc" value={newClient.localidad} onChange={(e) => setNewClient({ ...newClient, localidad: e.target.value })} className={field} /></div>
            </fieldset>
          )}
          <div><label htmlFor="sv-precio" className="sf-label">Precio final ($)</label><input id="sv-precio" inputMode="numeric" value={(form.precio) ? Number(form.precio).toLocaleString('es-AR') : ''} onChange={(e) => setForm({ ...form, precio: Number(digits(e.target.value)) })} className={field} /></div>
          <div><label htmlFor="sv-costo" className="sf-label">Costo del auto ($) <span className="sf-faint">(para la ganancia)</span></label><input id="sv-costo" inputMode="numeric" value={(form.costo) ? Number(form.costo).toLocaleString('es-AR') : ''} onChange={(e) => setForm({ ...form, costo: Number(digits(e.target.value)) })} className={field} /></div>
          <div><label htmlFor="sv-pago" className="sf-label">Forma de pago</label><div className="mt-2"><ComboField id="sv-pago" value={form.formaPago} onChange={(v) => setForm({ ...form, formaPago: v || 'Contado' })} options={PAGOS} allowCustom={false} /></div></div>
          {form.formaPago.includes('canje') && <div><label htmlFor="sv-canje" className="sf-label">Valor del usado entregado ($)</label><input id="sv-canje" inputMode="numeric" value={(form.canje) ? Number(form.canje).toLocaleString('es-AR') : ''} onChange={(e) => setForm({ ...form, canje: Number(digits(e.target.value)) })} className={field} /></div>}
          {form.formaPago.includes('inanciado') && <div><label htmlFor="sv-anticipo" className="sf-label">Anticipo cobrado ($)</label><input id="sv-anticipo" inputMode="numeric" value={(form.anticipo) ? Number(form.anticipo).toLocaleString('es-AR') : ''} onChange={(e) => setForm({ ...form, anticipo: Number(digits(e.target.value)) })} className={field} /></div>}
          <div><label htmlFor="sv-medio" className="sf-label">Medio de cobro (va a caja)</label><div className="mt-2"><ComboField id="sv-medio" value={cashMedio} onChange={(v) => setCashMedio(v || 'Efectivo')} options={MEDIOS} allowCustom={false} /></div></div>
          <div><label htmlFor="sv-vend" className="sf-label">Vendedor</label><input id="sv-vend" value={form.vendedor} onChange={(e) => setForm({ ...form, vendedor: e.target.value })} className={field} /></div>
          <div className="sm:col-span-2 lg:col-span-3"><label htmlFor="sv-contrato" className="sf-label">Contrato de venta <span className="sf-faint">(PDF, Word o foto)</span></label><input id="sv-contrato" type="file" accept=".pdf,.doc,.docx,image/*" onChange={(e) => setContract(e.target.files?.[0] ?? null)} className="mt-2 block w-full text-[0.9rem]" />{contract && <p className="sf-faint mt-1 text-[0.8rem]">{contract.name}</p>}</div>
          <div className="sm:col-span-2 lg:col-span-3"><label htmlFor="sv-notas" className="sf-label">Notas</label><textarea id="sv-notas" rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className={field} /></div>
          <p className="sf-muted sm:col-span-2 lg:col-span-3 text-[0.85rem]">Al guardar: el auto queda como vendido en el sitio y lo cobrado se suma a la caja.</p>
          {error && <p role="alert" className="sm:col-span-2 lg:col-span-3 text-[0.9rem]" style={{ color: 'var(--sf-warn, #e0a23a)' }}>{error}</p>}
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3"><button type="submit" className="sf-btn sf-btn-primary min-h-12 rounded-[10px]">Guardar venta</button><button type="button" className="sf-btn sf-btn-ghost min-h-12 rounded-[10px]" onClick={() => { setForm(null); setNewClient(null); setContract(null) }}>Cancelar</button></div>
        </form>
      )}
      {done && <SaleDone {...done} onClose={() => setDone(null)} />}
      <ul className="mt-4 grid gap-3">
        {sales.length === 0 && <li className="sf-muted">Todavía no hay ventas registradas.</li>}
        {sales.map((s) => (
          <li key={s.id} className="elv-pq-panel !p-4 flex flex-wrap items-center justify-between gap-3" style={s.anulada ? { opacity: 0.55 } : undefined}>
            <span className="min-w-0"><span className="block font-bold">{s.auto}</span><span className="sf-muted block text-[0.85rem]">{s.fecha} · {s.cliente} · {s.formaPago} · {s.vendedor}{s.anulada ? ' · ANULADA' : ''}</span></span>
            <span className="flex items-center gap-3"><span className="text-right"><span className="block font-bold tabular-nums">{money(s.precio)}</span>{s.costo > 0 && <span className="sf-faint block text-[0.8rem] tabular-nums">Ganancia {money(s.precio - s.costo)}</span>}</span>
              {s.contrato && <a className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]" href={s.contrato.url} download={s.contrato.nombre} target="_blank" rel="noreferrer">Contrato</a>}
              {!s.anulada && s.email && <a className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]" href={contractMail(s)}>Mail</a>}
              {!s.anulada && <button type="button" className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]" onClick={() => printReceipt(s)}>Comprobante</button>}
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
        <div><label htmlFor="cj-monto" className="sf-label">Monto ($)</label><input id="cj-monto" inputMode="numeric" value={(form.monto) ? Number(form.monto).toLocaleString('es-AR') : ''} onChange={(e) => setForm({ ...form, monto: digits(e.target.value) })} className={field} /></div>
        <div className="sm:col-span-1 lg:col-span-2"><label htmlFor="cj-det" className="sf-label">Detalle</label><input id="cj-det" value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} className={field} placeholder="Ej.: Seña Cronos, factura de luz…" /></div>
        {error && <p role="alert" className="sm:col-span-2 lg:col-span-3 text-[0.9rem]" style={{ color: 'var(--sf-warn, #e0a23a)' }}>{error}</p>}
        <div className="sm:col-span-2 lg:col-span-3"><button type="submit" className="sf-btn sf-btn-primary min-h-12 rounded-[10px]"><Plus className="size-4" aria-hidden="true" />Agregar movimiento</button></div>
      </form>
      <div className="elv-pq-panel grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div><p className="font-bold">Cierre de caja (arqueo de efectivo)</p><p className="sf-muted text-[0.85rem]">Cuenta el efectivo físico y anótalo: se guarda la diferencia con lo esperado ({money(cashOnly)}).</p>
          <label htmlFor="cj-count" className="sf-label mt-3 block">Efectivo contado ($)</label><input id="cj-count" inputMode="numeric" value={(count) ? Number(count).toLocaleString('es-AR') : ''} onChange={(e) => setCount(digits(e.target.value))} className={field} /></div>
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
    for (const r of listClients()) {
      const k = key(r.telefono, r.email, clientName(r))
      const c = map.get(k) ?? { nombre: `${clientName(r)} · registrado`, telefono: r.telefono, email: r.email, dni: r.dni, consultas: 0, compras: 0, ultima: r.creado }
      map.set(k, { ...c, dni: c.dni || r.dni })
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
      <div className="elv-pq-panel grid gap-3">
        <p className="font-bold">Respaldo de datos</p>
        <p className="sf-muted text-[0.85rem]">Descarga una copia de todo (consultas, autos, ventas, caja, usuarios y ajustes) o carga una copia anterior. Las fotos están en la carpeta "datos/fotos".</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="sf-btn sf-btn-outline min-h-12 rounded-[10px]" onClick={() => { const url = URL.createObjectURL(new Blob([exportAll()], { type: 'application/json' })); Object.assign(document.createElement('a'), { href: url, download: `elvis-respaldo-${today()}.json` }).click(); URL.revokeObjectURL(url); logActivity(user.name, 'Descargó un respaldo de datos') }}><Download className="size-4" aria-hidden="true" />Descargar respaldo</button>
          <label className="sf-btn sf-btn-ghost min-h-12 cursor-pointer rounded-[10px]">Cargar respaldo
            <input type="file" accept="application/json,.json" className="sr-only" onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; if (!window.confirm('¿Reemplazar todos los datos actuales por los del respaldo?')) return; try { importAll(await file.text()); logActivity(user.name, 'Cargó un respaldo de datos'); window.alert('Respaldo cargado.'); window.location.reload() } catch (err) { window.alert(err instanceof Error ? err.message : 'No se pudo cargar el respaldo.') } }} />
          </label>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3"><button type="submit" className="sf-btn sf-btn-primary min-h-12 rounded-[10px]">Guardar cambios del sitio</button><a href="/" target="_blank" rel="noreferrer" className="sf-btn sf-btn-ghost min-h-12 rounded-[10px]">Ver el sitio</a><button type="button" className="sf-btn sf-btn-outline min-h-12 rounded-[10px]" onClick={() => { if (window.confirm('¿Volver al diseño original? Se borran los colores, textos y aviso que cambiaste acá.')) { const keep: Record<string, string> = {}; for (const k of ['ofertaExpressNombre', 'ofertaProgresivaNombre', 'rifaNombre']) if (values[k]) keep[k] = values[k]; saveSiteSettings(keep); setValues(keep); logActivity(user.name, 'Restableció el diseño original del sitio'); setSaved(true) } }}>Restablecer diseño original</button>{saved && <span role="status" className="sf-muted">Guardado.</span>}</div>
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
