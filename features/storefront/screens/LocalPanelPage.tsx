'use client'
'use no memo' // Lee datos guardados fuera de React (carpeta datos): sin memorización automática.

import { useEffect, useMemo, useState } from 'react'
import { Download, LogOut, Pencil, Plus, Trash2 } from 'lucide-react'
import { Container } from '../components/Container'
import { LocalCarsTab } from './LocalCarsTab'
import { ActivitySection, CashSection, ClientsSection, PermissionsSection, SalesSection, SiteSection, SummarySection } from './LocalPanelSections'
import { ComboField } from '../components/ComboField'
import {
  ROLES, can, checkLogin, deleteSubmission, logActivity, isLocalDemo, listSubmissions, listUsers, newId, saveUsers, updateSubmission,
  type LocalSubmission, type LocalUser,
} from '../lib/localStore'

const STATUSES = ['nueva', 'contactado', 'cerrada']
const KINDS: Record<string, string> = { consulta: 'Consultas', precalificacion: 'Precalificador', usado: 'Usados ofrecidos', credito: 'Créditos', prueba: 'Pruebas de manejo', servicio: 'Servicio', reserva: 'Reservas' }
const SESSION = 'elvis:sesion'

const LABELS: Record<string, string> = {
  firstName: 'Nombre', lastName: 'Apellido', fullName: 'Nombre y apellido', email: 'Email', phone: 'Teléfono', message: 'Mensaje',
  preferredContact: 'Contactar por', contactTimes: 'Horario', intent: 'Tipo', dni: 'DNI', cuil: 'CUIL', locality: 'Localidad', province: 'Provincia',
  year: 'Año', make: 'Marca', model: 'Modelo', trim: 'Versión', mileage: 'Kilometraje', licensePlate: 'Patente', engineNumber: 'N.º de motor', vin: 'Chasis',
  condition: 'Estado', ownership: 'Titularidad', payoffAmount: 'Saldo de crédito', notes: 'Notas', vehiclePrice: 'Precio del vehículo', downPayment: 'Anticipo',
  loanTerm: 'Cuotas', monthlyPayment: 'Cuota estimada', requestedAmount: 'Monto a financiar', employmentStatus: 'Situación laboral', monthlyIncome: 'Ingresos',
  creditScore: 'Situación crediticia', listingUrl: 'Link de la publicación', preferredDate: 'Fecha', preferredTime: 'Hora', consent: 'Autorizó contacto',
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
// Prioridad de una precalificación según sus respuestas (orientativa, para ordenar llamados).
const SCORE: Array<[RegExp, number]> = [
  [/Quiero comprar de contado/, 3], [/Empleado en blanco|Autónomo en blanco|Jubilado/, 2], [/Empleado en negro|Autónomo en negro/, 0], [/Desempleado/, -3],
  [/Más de \$5 millones/, 2], [/\$2 a \$5 millones/, 1], [/Uso y pago al día|No uso tarjeta/, 1], [/Estoy atrasado actualmente/, -3], [/algún atraso y ya lo regularicé/, 0],
  [/Tengo atrasos en créditos/, -3], [/lo pago al día|Terminé de pagar/, 1], [/Ya sé que hoy no me aprueban|Veraz/, -4], [/ya califiqué en otro lado/, 2],
  [/Esta semana/, 2], [/Dentro de 30 días/, 1], [/Solo estoy averiguando/, -1], [/Sí, tengo permuta/, 1],
]
function leadPriority(item: LocalSubmission): { label: string; tone: string } | null {
  const answers = item.data.answers
  if (!Array.isArray(answers)) return null
  const text = answers.map((a: { answer?: string }) => a.answer ?? '').join(' | ')
  const score = SCORE.reduce((total, [pattern, points]) => total + (pattern.test(text) ? points : 0), 0)
  return score >= 5 ? { label: 'Prioridad alta', tone: '#3fb37f' } : score >= 2 ? { label: 'Prioridad media', tone: '#e0a23a' } : { label: 'Prioridad baja', tone: '#9a9a9a' }
}
const who = (s: LocalSubmission) => String(s.data.fullName || [s.data.firstName, s.data.lastName].filter(Boolean).join(' ') || 'Sin nombre')
const fmtDate = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

export function LocalPanelPage() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<LocalUser | null>(null)
  const [tab, setTab] = useState('')
  const [items, setItems] = useState<LocalSubmission[]>([])
  const [users, setUsers] = useState<LocalUser[]>([])
  const [kind, setKind] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
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
  const filtered = items.filter((i) => {
    if (kind && i.kind !== kind) return false
    if (statusFilter && i.status !== statusFilter) return false
    if (!search.trim()) return true
    const haystack = `${who(i)} ${Object.values(i.data).map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''))).join(' ')}`.toLowerCase()
    return search.toLowerCase().split(/\s+/).every((word) => haystack.includes(word))
  })
  const counts = useMemo(() => items.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] ?? 0) + 1 }), {}), [items])

  function doLogin(event: React.FormEvent) {
    event.preventDefault()
    const found = checkLogin(login.username, login.password)
    if (!found) { setLogin((l) => ({ ...l, error: 'Usuario o contraseña incorrectos.' })); return }
    try { window.sessionStorage.setItem(SESSION, found.id) } catch { /* sin almacenamiento */ }
    logActivity(found.name, 'Ingresó al panel')
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
    saveUsers(next); setUsers(next); logActivity(user?.name ?? '', `${users.some((u) => u.id === editing.id) ? 'Editó' : 'Creó'} el usuario ${username} (${editing.role})`); setEditing(null); setFormError('')
  }
  function removeUser(target: LocalUser) {
    const next = users.filter((u) => u.id !== target.id)
    if (!next.some((u) => u.active && u.role === 'Administrador')) { window.alert('Debe quedar al menos un administrador activo.'); return }
    if (!window.confirm(`¿Borrar a ${target.name}?`)) return
    saveUsers(next); setUsers(next); logActivity(user?.name ?? '', `Borró el usuario ${target.username}`)
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

  const allSections: Array<[string, string]> = [['resumen', 'Resumen'], ['consultas', `Consultas (${items.filter((i) => i.status === 'nueva').length})`], ['autos', 'Autos'], ['ventas', 'Ventas'], ['caja', 'Caja'], ['clientes', 'Clientes'], ['sitio', 'Sitio'], ['usuarios', 'Usuarios'], ['permisos', 'Permisos'], ['actividad', 'Actividad']]
  const sections = allSections.filter(([key]) => can(user, key === 'permisos' ? 'usuarios' : key))
  const current = sections.some(([key]) => key === tab) ? tab : sections[0]?.[0] ?? ''
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

        <nav className="elv-panel-nav mt-6" role="tablist" aria-label="Secciones del panel">
          {sections.map(([key, label]) => (
            <button key={key} type="button" role="tab" className="sf-pill min-h-11 shrink-0" aria-pressed={current === key} aria-selected={current === key} onClick={() => { refresh(); setTab(key) }}>{label}</button>
          ))}
        </nav>

        {current === 'resumen' ? <SummarySection go={(key, filter) => { refresh(); if (key === 'consultas') { setStatusFilter(filter ?? ''); setKind(''); setSearch('') } setTab(key) }} />
        : current === 'ventas' ? <SalesSection user={user} />
        : current === 'caja' ? <CashSection user={user} />
        : current === 'clientes' ? <ClientsSection />
        : current === 'sitio' ? <SiteSection user={user} />
        : current === 'permisos' ? <PermissionsSection user={user} />
        : current === 'actividad' ? <ActivitySection />
        : current === 'autos' ? (
          <LocalCarsTab user={user} />
        ) : current === 'consultas' ? (
          <div className="mt-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full sm:w-64">
                <label htmlFor="lp-kind" className="sf-label">Tipo</label>
                <div className="mt-2"><ComboField id="lp-kind" value={kind ? KINDS[kind] : ''} onChange={(v) => setKind(Object.keys(KINDS).find((k) => KINDS[k] === v) ?? '')} options={Object.keys(KINDS).map((k) => KINDS[k])} allowCustom={false} placeholder="Todas" /></div>
              </div>
              <div className="w-full sm:w-48">
                <label htmlFor="lp-status" className="sf-label">Estado</label>
                <div className="mt-2"><ComboField id="lp-status" value={statusFilter} onChange={setStatusFilter} options={STATUSES} allowCustom={false} placeholder="Todos" /></div>
              </div>
              <div className="w-full min-w-0 sm:flex-1">
                <label htmlFor="lp-search" className="sf-label">Buscar</label>
                <input id="lp-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="sf-input mt-2 w-full" placeholder="Nombre, teléfono, email, patente, auto…" />
              </div>
              <button type="button" onClick={exportCsv} disabled={!filtered.length} className="sf-btn sf-btn-outline min-h-12 rounded-[10px]"><Download className="size-4" aria-hidden="true" />Exportar a Excel</button>
            </div>
            {(kind || statusFilter || search) && <p className="sf-muted mt-2 text-[0.85rem]" role="status">{filtered.length} de {items.length} consultas · <button type="button" className="sf-link min-h-11" onClick={() => { setKind(''); setStatusFilter(''); setSearch('') }}>Quitar filtros</button></p>}
            <p className="sf-faint mt-3 text-[0.8rem]">{Object.entries(counts).map(([k, n]) => `${KINDS[k] ?? k}: ${n}`).join(' · ') || 'Todavía no llegaron consultas.'}</p>
            <ul className="mt-4 grid gap-3">
              {filtered.map((item) => (
                <li key={item.id} className="elv-pq-panel !p-4">
                  <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 text-left" aria-expanded={open === item.id} onClick={() => setOpen(open === item.id ? null : item.id)}>
                    <span className="min-w-0">
                      <span className="block font-bold">{who(item)}</span>
                      <span className="sf-muted block text-[0.85rem]">{item.label} · {fmtDate(item.createdAt)}{item.data.phone ? ` · ${item.data.phone}` : ''}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      {(() => { const pr = leadPriority(item); return pr ? <span className="sf-chip" style={{ borderColor: pr.tone, color: pr.tone }}>{pr.label}</span> : null })()}
                      <span className="sf-chip" data-status={item.status}>{item.status}</span>
                    </span>
                  </button>
                  {open === item.id && (
                    <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--sf-rule)' }}>
                      <dl className="grid gap-2 text-[0.9rem] sm:grid-cols-[12rem_1fr]">
                        {Object.entries(item.data).map(([key, value]) => {
                          const text = valueText(key, value)
                          return text ? <div key={key} className="contents"><dt className="sf-muted">{LABELS[key] ?? (key === 'answers' ? 'Respuestas' : key)}</dt><dd className="whitespace-pre-line">{text}</dd></div> : null
                        })}
                      </dl>
                      {item.photos && item.photos.length > 0 && (
                        <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Fotos enviadas">
                          {item.photos.map((url, index) => (
                            <li key={url}><a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[8px] border" style={{ borderColor: 'var(--sf-rule)' }} aria-label={`Abrir foto ${index + 1}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={`Foto ${index + 1}`} className="aspect-square w-full object-cover" />
                            </a></li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {STATUSES.map((s) => <button key={s} type="button" className="sf-pill min-h-11 rounded-[8px] border" style={{ borderColor: 'var(--sf-rule)' }} aria-pressed={item.status === s} onClick={() => { updateSubmission(item.id, { status: s }); logActivity(user.name, `Marcó como ${s} la consulta de ${who(item)}`); refresh() }}>{s}</button>)}
                        {item.data.phone ? <a className="sf-btn sf-btn-primary min-h-11 rounded-[8px]" href={`https://wa.me/549${String(item.data.phone).replace(/\D/g, '').replace(/^0/, '')}`} target="_blank" rel="noreferrer">Escribir por WhatsApp</a> : null}
                        <button type="button" className="sf-btn sf-btn-ghost min-h-11 rounded-[8px]" onClick={() => { if (window.confirm('¿Borrar esta consulta?')) { deleteSubmission(item.id); logActivity(user.name, `Borró la consulta de ${who(item)}`); refresh() } }}><Trash2 className="size-4" aria-hidden="true" />Borrar</button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : current === 'usuarios' ? (
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
        ) : (
          <p className="sf-muted mt-6">Tu rol no tiene secciones habilitadas. Pídele a un administrador que te dé permisos.</p>
        )}
      </Container>
    </section>
  )
}
