'use client'
'use no memo'

import { useState } from 'react'
import { Download, LogOut } from 'lucide-react'
import { Container } from '../components/Container'
import { clientName, findClient, listClients, listSales, newId, saveClient, siteSettings, type Client } from '../lib/localStore'

const field = 'sf-input mt-2 w-full'
const money = (n: number) => `$ ${Math.round(n || 0).toLocaleString('es-AR')}`
const digits = (v: string) => v.replace(/\D/g, '')
const emailOk = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())

/** Crear usuario de cliente. Si ya estaba registrado por una venta (mismo DNI y email), activa su cuenta. */
export function ClientSignup({ onBack, onDone }: { onBack: () => void; onDone: (c: Client) => void }) {
  const [f, setF] = useState({ nombre: '', apellido: '', dni: '', email: '', telefono: '', usuario: '', clave: '', clave2: '' })
  const [error, setError] = useState('')
  const set = (patch: Partial<typeof f>) => { setF({ ...f, ...patch }); setError('') }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const dni = digits(f.dni)
    if (!f.nombre.trim() || !f.apellido.trim()) return setError('Completa nombre y apellido.')
    if (dni.length < 7) return setError('El DNI tiene que tener 7 u 8 números.')
    if (!emailOk(f.email)) return setError('Escribe un email válido.')
    if (f.usuario.trim().length < 3) return setError('El usuario tiene que tener al menos 3 caracteres.')
    if (f.clave.length < 4) return setError('La contraseña tiene que tener al menos 4 caracteres.')
    if (f.clave !== f.clave2) return setError('Las contraseñas no coinciden.')
    const clients = listClients()
    if (clients.some((c) => c.usuario?.toLowerCase() === f.usuario.trim().toLowerCase())) return setError('Ese usuario ya existe. Elige otro.')
    const existing = clients.find((c) => c.dni === dni)
    if (existing?.clave) return setError('Ya hay una cuenta con ese DNI. Usa “Olvidé mi usuario o contraseña”.')
    if (existing && existing.email.toLowerCase() !== f.email.trim().toLowerCase()) return setError('Ese DNI ya está registrado con otro email. Escríbenos para revisarlo.')
    const client: Client = existing
      ? { ...existing, usuario: f.usuario.trim(), clave: f.clave, telefono: existing.telefono || f.telefono }
      : { id: newId('CLI').toLowerCase(), nombre: f.nombre.trim(), apellido: f.apellido.trim(), dni, email: f.email.trim(), telefono: f.telefono.trim(), domicilio: '', localidad: '', creado: new Date().toISOString(), usuario: f.usuario.trim(), clave: f.clave }
    saveClient(client)
    onDone(client)
  }

  return (
    <section className="py-14">
      <Container className="max-w-md">
        <form onSubmit={submit} className="elv-pq-panel grid gap-4" noValidate>
          <div><h1 className="sf-display text-[1.6rem]">Crear usuario</h1><p className="sf-muted mt-1 text-[0.9rem]">Para ver tus compras y tus contratos. Si ya compraste en Elvis, usa el mismo DNI y email.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="cs-nombre" className="sf-label">Nombre</label><input id="cs-nombre" autoComplete="given-name" value={f.nombre} onChange={(e) => set({ nombre: e.target.value })} className={field} /></div>
            <div><label htmlFor="cs-apellido" className="sf-label">Apellido</label><input id="cs-apellido" autoComplete="family-name" value={f.apellido} onChange={(e) => set({ apellido: e.target.value })} className={field} /></div>
            <div><label htmlFor="cs-dni" className="sf-label">DNI</label><input id="cs-dni" inputMode="numeric" value={f.dni} onChange={(e) => set({ dni: digits(e.target.value).slice(0, 8) })} className={field} /></div>
            <div><label htmlFor="cs-tel" className="sf-label">Teléfono <span className="sf-faint">(opcional)</span></label><input id="cs-tel" inputMode="tel" autoComplete="tel" value={f.telefono} onChange={(e) => set({ telefono: e.target.value })} className={field} /></div>
          </div>
          <div><label htmlFor="cs-email" className="sf-label">Email</label><input id="cs-email" type="email" inputMode="email" autoComplete="email" value={f.email} onChange={(e) => set({ email: e.target.value })} className={field} /></div>
          <div><label htmlFor="cs-user" className="sf-label">Usuario</label><input id="cs-user" autoCapitalize="none" autoComplete="username" value={f.usuario} onChange={(e) => set({ usuario: e.target.value })} className={field} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="cs-pass" className="sf-label">Contraseña</label><input id="cs-pass" type="password" autoComplete="new-password" value={f.clave} onChange={(e) => set({ clave: e.target.value })} className={field} /></div>
            <div><label htmlFor="cs-pass2" className="sf-label">Repetir contraseña</label><input id="cs-pass2" type="password" autoComplete="new-password" value={f.clave2} onChange={(e) => set({ clave2: e.target.value })} className={field} /></div>
          </div>
          {error && <p role="alert" className="text-[0.9rem]" style={{ color: 'var(--sf-warn, #e0a23a)' }}>{error}</p>}
          <button type="submit" className="sf-btn sf-btn-primary min-h-12 w-full rounded-[10px]">Crear usuario</button>
          <button type="button" className="sf-link min-h-11 text-[0.9rem]" onClick={onBack}>Ya tengo usuario: ingresar</button>
        </form>
      </Container>
    </section>
  )
}

/** Recuperar acceso: sin envío de mails desde el sitio; se pide a Elvis por WhatsApp. */
export function ForgotAccess({ onBack }: { onBack: () => void }) {
  const [id, setId] = useState('')
  const [result, setResult] = useState<null | { found: boolean; usuario?: string }>(null)
  const site = siteSettings()
  const phone = digits(site.whatsapp || '1127235886').replace(/^0/, '')
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const c = findClient(digits(id).length >= 7 && !id.includes('@') ? digits(id) : id)
    setResult(c ? { found: true, usuario: c.usuario } : { found: false })
  }
  const message = `Hola Elvis, olvidé mi usuario o contraseña de clientes. Mi DNI o email es: ${id.trim()}`
  return (
    <section className="py-14">
      <Container className="max-w-sm">
        <form onSubmit={submit} className="elv-pq-panel grid gap-4">
          <div><h1 className="sf-display text-[1.6rem]">Recuperar acceso</h1><p className="sf-muted mt-1 text-[0.9rem]">Escribe tu DNI o el email con el que te registraste.</p></div>
          <div><label htmlFor="fa-id" className="sf-label">DNI o email</label><input id="fa-id" value={id} onChange={(e) => { setId(e.target.value); setResult(null) }} className={field} autoCapitalize="none" /></div>
          <button type="submit" className="sf-btn sf-btn-primary min-h-12 w-full rounded-[10px]" disabled={!id.trim()}>Buscar mi cuenta</button>
          {result && (
            <div role="status" className="grid gap-3">
              {result.found && result.usuario ? <p>Tu usuario es <strong>{result.usuario}</strong>. Si no recuerdas la contraseña, pídenos una nueva:</p>
                : result.found ? <p>Estás registrado como cliente pero todavía no creaste tu usuario. Usa “Crear usuario” con tu mismo DNI y email.</p>
                : <p>No encontramos una cuenta con ese dato. Puedes crear un usuario o escribirnos:</p>}
              <a className="sf-btn sf-btn-outline min-h-12 w-full rounded-[10px]" href={`https://wa.me/549${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Pedir ayuda por WhatsApp</a>
            </div>
          )}
          <button type="button" className="sf-link min-h-11 text-[0.9rem]" onClick={onBack}>Volver a ingresar</button>
        </form>
      </Container>
    </section>
  )
}

/** Área del cliente: sus datos, compras y contratos. */
export function ClientArea({ client, onLogout }: { client: Client; onLogout: () => void }) {
  const sales = listSales().filter((s) => !s.anulada && (s.clienteId === client.id || (client.dni && s.dni === client.dni)))
  return (
    <section className="py-10">
      <Container className="max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="sf-display text-[1.6rem]">Hola, {client.nombre}</h1><p className="sf-muted text-[0.9rem]">Área de clientes de Elvis</p></div>
          <button type="button" onClick={onLogout} className="sf-btn sf-btn-ghost min-h-11 rounded-[10px]"><LogOut className="size-4" aria-hidden="true" />Salir</button>
        </div>
        <div className="elv-pq-panel mt-6">
          <p className="font-bold">Tus datos</p>
          <p className="sf-muted mt-2 text-[0.9rem]">{clientName(client)} · DNI {client.dni} · {client.email}{client.telefono ? ` · ${client.telefono}` : ''}</p>
        </div>
        <div className="elv-pq-panel mt-4">
          <p className="font-bold">Tus compras</p>
          {sales.length === 0 ? <p className="sf-muted mt-2">Todavía no tienes compras registradas.</p> : (
            <ul className="mt-3 grid gap-3">
              {sales.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--sf-rule)' }}>
                  <span><span className="block font-semibold">{s.auto}</span><span className="sf-muted block text-[0.85rem]">{s.fecha.split('-').reverse().join('/')} · {money(s.precio)} · {s.formaPago}</span></span>
                  {s.contrato ? <a className="sf-btn sf-btn-outline min-h-11 rounded-[10px]" href={s.contrato.url} download={s.contrato.nombre} target="_blank" rel="noreferrer"><Download className="size-4" aria-hidden="true" />Contrato</a> : <span className="sf-faint text-[0.85rem]">Contrato pendiente</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </section>
  )
}
