'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, LogOut, Pencil, Plus, Trash2 } from 'lucide-react'
import { Container } from '../components/Container'
import { ComboField } from '../components/ComboField'
import {
  checkLogin, deleteSubmission, isLocalDemo, listSubmissions, listUsers, newId, saveUsers, updateSubmission,
  type LocalSubmission, type LocalUser,
} from '../lib/localStore'

const ROLES = ['Administrador', 'Gerente de ventas', 'Vendedor', 'Responsable de créditos', 'Administración']
const STATUSES = ['nueva', 'contactado', 'cerrada']
const KINDS: Record<string, string> = { consulta: 'Consultas', precalificacion: 'Precalificador', usado: 'Usados ofrecidos', credito: 'Créditos', prueba: 'Pruebas de manejo', servicio: 'Servicio', reserva: 'Reservas' }
const SESSION = 'elvis:sesion'

const LABELS: Record<string, string> = {
  firstName: 'Nombre', lastName: 'Apellido', fullName: 'Nombre y apellido', email: 'Email', phone: 'Teléfono', message: 'Mensaje',
  preferredContact: 'Contactar por', contactTimes: 'Horario', intent: 'Tipo', dni: 'DNI', cuil: 'CUIL', locality: 'Localidad', province: 'Provincia',
  year: 'Año', make: 'Marca', model: 'Modelo', trim: 'Versión', mileage: 'Kilometraje', licensePlate: 'Patente', engineNumber: 'N.º de motor', vin: 'Chasis',
  condition: 'Estado', ownership: 'Titularidad', payoffAmount: 'Saldo de crédito', notes: 'Notas', vehiclePrice: 'Precio del vehículo', downPayment: 'Anticipo',
  loanTerm: 'Cuotas', monthlyPayment: 'Cuota estimada', requestedAmount: 'Monto a financiar', employmentStatus: 'Situación laboral', monthlyIncome: 'Ingresos',
  creditScore: 'Situación crediticia', preferredDate: 'Fecha', preferredTime: 'Hora', consent: 'Autorizó contacto',
}
const TIME = { morning: 'Mañana', afternoon: 'Tarde' } as Record<string, string>

function valueText(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (key === 'contactTimes' && Array.isArray(value)) return value.map((v) => TIME[String(v)] ?? String(v)).join(' y ')
  if (key === 'answers' && Array.isArray(value)) return value.map((a: { question: string; answer: string }) => `${a.question} → ${a.answer}`).join('\n')
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
const who = (s: LocalSubmission) => String(s.data.fullName || [s.data.firstName, s.data.lastName].filter(Boolean).join(' ') || 'Sin nombre')
const fmtDate = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

export function LocalPanelPage() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<LocalUser | null>(null)
  const [tab, setTab] = useState<'consultas' | 'usuarios'>('consultas')
  const [items, setItems] = useState<LocalSubmission[]>([])
  const [users, setUsers] = useState<LocalUser[]>([])
  const [kind, setKind] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [login, setLogin] = useState({ username: '', password: '', error: '' })
  const [editing, setEditing] = useState<LocalUser | null>(null)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!isLocalDemo()) { window.location.replace('/dashboard'); return }
    const saved = (() => { try { return window.sessionStorage.getItem(SESSION) } catch { return null } })()
    const all = listUsers()
    setUsers(all)
    setItems(listSubmissions())
    setUser(all.find((u) => u.id === saved && u.active) ?? null)
    setReady(true)
  }, [])

  const refresh = () => { setItems(listSubmissions()); setUsers(listUsers()) }
  const filtered = useMemo(() => items.filter((i) => !kind || i.kind === kind), [items, kind])
  const counts = useMemo(() => items.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] ?? 0) + 1 }), {}), [items])

  function doLogin(event: React.FormEvent) {
    event.preventDefault()
    const found = checkLogin(login.username, login.password)
    if (!found) { setLogin((l) => ({ ...l, error: 'Usuario o contraseña incorrectos.' })); return }
    try { window.sessionStorage.setItem(SESSION, found.id) } catch { /* sin almacenamiento */ }
    setUser(found)
  }
  function logout() { try { window.sessionStorage.removeItem(SESSION) } catch { /* nada */ } setUser(null); setLogin({ username: '', password: '', error: '' }) }

  function exportCsv() {
    const keys = [...new Set(filtered.flatMap((i) => Object.keys(i.data)))]
    const rows = [['Fecha', 'Tipo', 'Estado', ...keys.map((k) => LABELS[k] ?? k)], ...filtered.map((i) => [fmtDate(i.createdAt), i.label, i.status, ...keys.map((k) => valueText(k, i.data[k]))])]
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `elvis-consultas-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click(); URL.revokeObjectURL(url)
  }

  function saveUser(event: React.FormEvent) {
    event.preventDefault()
    if (!editing) return
    const name = editing.name.trim(), username = editing.username.trim()
    if (!name || !username || editing.password.length < 3) { setFormError('Completa nombre, usuario y una contraseña de al menos 3 caracteres.'); return }
    if (users.some((u) => u.id !== editing.id && u.username.toLowerCase() === username.toLowerCase())) { setFormError('Ese usuario ya existe.'); return }
    const next = users.some((u) => u.id === editing.id) ? users.map((u) => (u.id === editing.id ? { ...editing, name, username } : u)) : [...users, { ...editing, name, username }]
    if (!next.some((u) => u.active && u.role === 'Administrador')) { setFormError('Debe quedar al menos un administrador activo.'); return }
    saveUsers(next); setUsers(next); setEditing(null); setFormError('')
  }
  function removeUser(target: LocalUser) {
    const next = users.filter((u) => u.id !== target.id)
    if (!next.some((u) => u.active && u.role === 'Administrador')) { window.alert('Debe quedar al menos un administrador activo.'); return }
    if (!window.confirm(`¿Borrar a ${target.name}?`)) return
    saveUsers(next); setUsers(next)
  }

  if (!ready) return null
  if (!user) {
    return (
      <section className="py-14">
        <Container className="max-w-sm">
          <form onSubmit={doLogin} className="elv-pq-panel">
            <h1 className="sf-display text-[1.6rem]">Panel de Elvis</h1>
            <p className="sf-muted mt-1 text-[0.9rem]">Ingresa con tu usuario.</p>
            <label htmlFor="lp-user" className="sf-label mt-6 block">Usuario</label>
            <input id="lp-user" autoComplete="username" autoCapitalize="none" value={login.username} onChange={(e) => setLogin((l) => ({ ...l, username: e.target.value, error: '' }))} className="sf-input mt-2 w-full" />
            <label htmlFor="lp-pass" className="sf-label mt-4 block">Contraseña</label>
            <input id="lp-pass" type="password" autoComplete="current-password" value={login.password} onChange={(e) => setLogin((l) => ({ ...l, password: e.target.value, error: '' }))} className="sf-input mt-2 w-full" />
            {login.error && <p role="alert" className="mt-3 text-[0.9rem]" style={{ color: 'var(--sf-warn, #e0a23a)' }}>{login.error}</p>}
            <button type="submit" className="sf-btn sf-btn-primary mt-6 min-h-12 w-full rounded-[10px]">Ingresar</button>
          </form>
        </Container>
      </section>
    )
  }

  const isAdmin = user.role === 'Administrador'
  return (
    <section className="py-8 md:py-12">
      <Container>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="sf-display text-[1.6rem]">Panel de Elvis</h1>
            <p className="sf-muted text-[0.9rem]">{user.name} · {user.role}</p>
          </div>
          <button type="button" onClick={logout} className="sf-btn sf-btn-ghost min-h-11 rounded-[10px]"><LogOut className="size-4" aria-hidden="true" />Salir</button>
        </div>

        <div className="sf-track sf-track-choices mt-6" role="tablist">
          <button type="button" role="tab" className="sf-pill min-h-11" aria-pressed={tab === 'consultas'} aria-selected={tab === 'consultas'} onClick={() => { refresh(); setTab('consultas') }}>Consultas ({items.length})</button>
          {isAdmin && <button type="button" role="tab" className="sf-pill min-h-11" aria-pressed={tab === 'usuarios'} aria-selected={tab === 'usuarios'} onClick={() => setTab('usuarios')}>Usuarios ({users.length})</button>}
        </div>

        {tab === 'consultas' ? (
          <div className="mt-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full sm:w-64">
                <label htmlFor="lp-kind" className="sf-label">Tipo</label>
                <div className="mt-2"><ComboField id="lp-kind" value={kind ? KINDS[kind] : ''} onChange={(v) => setKind(Object.keys(KINDS).find((k) => KINDS[k] === v) ?? '')} options={Object.keys(KINDS).map((k) => KINDS[k])} allowCustom={false} placeholder="Todas" /></div>
              </div>
              <button type="button" onClick={exportCsv} disabled={!filtered.length} className="sf-btn sf-btn-outline min-h-12 rounded-[10px]"><Download className="size-4" aria-hidden="true" />Exportar a Excel</button>
            </div>
            <p className="sf-faint mt-3 text-[0.8rem]">{Object.entries(counts).map(([k, n]) => `${KINDS[k] ?? k}: ${n}`).join(' · ') || 'Todavía no llegaron consultas.'}</p>
            <ul className="mt-4 grid gap-3">
              {filtered.map((item) => (
                <li key={item.id} className="elv-pq-panel !p-4">
                  <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 text-left" aria-expanded={open === item.id} onClick={() => setOpen(open === item.id ? null : item.id)}>
                    <span className="min-w-0">
                      <span className="block font-bold">{who(item)}</span>
                      <span className="sf-muted block text-[0.85rem]">{item.label} · {fmtDate(item.createdAt)}{item.data.phone ? ` · ${item.data.phone}` : ''}</span>
                    </span>
                    <span className="sf-chip" data-status={item.status}>{item.status}</span>
                  </button>
                  {open === item.id && (
                    <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--sf-rule)' }}>
                      <dl className="grid gap-2 text-[0.9rem] sm:grid-cols-[12rem_1fr]">
                        {Object.entries(item.data).map(([key, value]) => {
                          const text = valueText(key, value)
                          return text ? <div key={key} className="contents"><dt className="sf-muted">{LABELS[key] ?? (key === 'answers' ? 'Respuestas' : key)}</dt><dd className="whitespace-pre-line">{text}</dd></div> : null
                        })}
                      </dl>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {STATUSES.map((s) => <button key={s} type="button" className="sf-pill min-h-11 rounded-[8px] border" style={{ borderColor: 'var(--sf-rule)' }} aria-pressed={item.status === s} onClick={() => { updateSubmission(item.id, { status: s }); refresh() }}>{s}</button>)}
                        {item.data.phone ? <a className="sf-btn sf-btn-primary min-h-11 rounded-[8px]" href={`https://wa.me/549${String(item.data.phone).replace(/\D/g, '').replace(/^0/, '')}`} target="_blank" rel="noreferrer">Escribir por WhatsApp</a> : null}
                        <button type="button" className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]" onClick={() => { if (window.confirm('¿Borrar esta consulta?')) { deleteSubmission(item.id); refresh() } }}><Trash2 className="size-4" aria-hidden="true" />Borrar</button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-6">
            <button type="button" className="sf-btn sf-btn-primary min-h-12 rounded-[10px]" onClick={() => { setFormError(''); setEditing({ id: newId('U'), name: '', username: '', password: '', role: 'Vendedor', active: true, createdAt: new Date().toISOString() }) }}><Plus className="size-4" aria-hidden="true" />Nuevo usuario</button>
            {editing && (
              <form onSubmit={saveUser} className="elv-pq-panel mt-4 grid gap-4 sm:grid-cols-2">
                <div><label htmlFor="lu-name" className="sf-label">Nombre y apellido</label><input id="lu-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="sf-input mt-2 w-full" /></div>
                <div><label htmlFor="lu-user" className="sf-label">Usuario</label><input id="lu-user" autoCapitalize="none" value={editing.username} onChange={(e) => setEditing({ ...editing, username: e.target.value })} className="sf-input mt-2 w-full" /></div>
                <div><label htmlFor="lu-pass" className="sf-label">Contraseña</label><input id="lu-pass" type="text" value={editing.password} onChange={(e) => setEditing({ ...editing, password: e.target.value })} className="sf-input mt-2 w-full" /></div>
                <div><label htmlFor="lu-role" className="sf-label">Rol</label><div className="mt-2"><ComboField id="lu-role" value={editing.role} onChange={(v) => setEditing({ ...editing, role: v || 'Vendedor' })} options={ROLES} allowCustom={false} /></div></div>
                <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="size-5" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />Activo (puede ingresar)</label>
                {formError && <p role="alert" className="sm:col-span-2 text-[0.9rem]" style={{ color: 'var(--sf-warn, #e0a23a)' }}>{formError}</p>}
                <div className="flex flex-wrap gap-2 sm:col-span-2"><button type="submit" className="sf-btn sf-btn-primary min-h-12 rounded-[10px]">Guardar</button><button type="button" className="sf-btn sf-btn-ghost min-h-12 rounded-[10px]" onClick={() => setEditing(null)}>Cancelar</button></div>
              </form>
            )}
            <ul className="mt-4 grid gap-3">
              {users.map((u) => (
                <li key={u.id} className="elv-pq-panel !p-4 flex flex-wrap items-center justify-between gap-3">
                  <span><span className="block font-bold">{u.name}</span><span className="sf-muted text-[0.85rem]">Usuario: {u.username} · {u.role}{u.active ? '' : ' · Inactivo'}</span></span>
                  <span className="flex gap-2">
                    <button type="button" className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]" onClick={() => { setFormError(''); setEditing(u) }}><Pencil className="size-4" aria-hidden="true" />Editar</button>
                    {u.id !== user.id && <button type="button" className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]" onClick={() => removeUser(u)}><Trash2 className="size-4" aria-hidden="true" />Borrar</button>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Container>
    </section>
  )
}
