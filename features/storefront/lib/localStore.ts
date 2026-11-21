'use client'

// Muestra local (demostración, sin servidor de datos). Todo lo que se carga —consultas, usuarios,
// autos y fotos— se guarda en la carpeta "datos" junto a INICIAR-MUESTRA.bat (el iniciador expone
// /_local/db y /_local/fotos). Se guarda además una copia en el navegador por si acaso.
// Se activa solo cuando la página la sirve el iniciador (window.__ELVIS_OFFLINE__).

export type LocalSubmission = { id: string; kind: string; label: string; createdAt: string; status: string; data: Record<string, unknown>; photos?: string[] }
export type LocalUser = { id: string; name: string; username: string; password: string; role: string; active: boolean; createdAt: string }
export type LocalCar = Record<string, any> & { id: string }
type CarChanges = { added: LocalCar[]; edits: Record<string, Partial<LocalCar>>; deleted: string[] }
export type Client = { id: string; nombre: string; apellido: string; dni: string; telefono: string; email: string; domicilio: string; localidad: string; creado: string; usuario?: string; clave?: string }
export type Sale = { id: string; fecha: string; autoId: string; auto: string; clienteId?: string; email?: string; contrato?: { nombre: string; url: string }; cliente: string; telefono: string; dni: string; precio: number; costo: number; formaPago: string; anticipo: number; canje: number; vendedor: string; notas: string; anulada?: boolean }
export type CashMove = { id: string; fecha: string; tipo: 'ingreso' | 'egreso'; categoria: string; medio: string; monto: number; detalle: string; usuario: string; ventaId?: string }
export type CashClose = { id: string; fecha: string; esperado: number; contado: number; diferencia: number; usuario: string; nota: string }
export type Activity = { id: string; fecha: string; usuario: string; accion: string }
export type SiteSettings = Record<string, string>
export type OfferSection = { id: string; nombre: string; descripcion: string; activa: boolean }
export type RaffleEntry = { numero: number; nombre: string; telefono: string; estado: 'reservado' | 'pagado'; fecha: string }
export type Raffle = { id: string; titulo: string; premio: string; autoId: string; precioNumero: number; cantidad: number; fechaSorteo: string; estado: 'activa' | 'cerrada' | 'sorteada'; bases: string; numeros: RaffleEntry[]; ganador: number | null; creada: string }
type Db = { consultas: LocalSubmission[]; usuarios: LocalUser[]; autos: CarChanges; ventas: Sale[]; caja: CashMove[]; cierres: CashClose[]; actividad: Activity[]; permisos: Record<string, string[]>; sitio: SiteSettings; secciones: OfferSection[]; rifas: Raffle[]; visitas: Record<string, Record<string, number>>; carga: number[]; clientes: Client[] }

const MIRROR = 'elvis:datos'
const EMPTY: Db = { consultas: [], usuarios: [], autos: { added: [], edits: {}, deleted: [] }, ventas: [], caja: [], cierres: [], actividad: [], permisos: {}, sitio: {}, secciones: [], rifas: [], visitas: {}, carga: [], clientes: [] }

export function isLocalDemo() {
  return typeof window !== 'undefined' && (window as unknown as { __ELVIS_OFFLINE__?: boolean }).__ELVIS_OFFLINE__ === true
}

let cache: Db | null = null
let diskAvailable = false

function normalize(raw: any): Db {
  return {
    consultas: Array.isArray(raw?.consultas) ? raw.consultas : [],
    usuarios: Array.isArray(raw?.usuarios) ? raw.usuarios : [],
    autos: { added: raw?.autos?.added ?? [], edits: raw?.autos?.edits ?? {}, deleted: raw?.autos?.deleted ?? [] },
    ventas: Array.isArray(raw?.ventas) ? raw.ventas : [],
    caja: Array.isArray(raw?.caja) ? raw.caja : [],
    cierres: Array.isArray(raw?.cierres) ? raw.cierres : [],
    actividad: Array.isArray(raw?.actividad) ? raw.actividad : [],
    permisos: raw?.permisos && typeof raw.permisos === 'object' ? raw.permisos : {},
    sitio: raw?.sitio && typeof raw.sitio === 'object' ? raw.sitio : {},
    secciones: Array.isArray(raw?.secciones) ? raw.secciones : [],
    rifas: Array.isArray(raw?.rifas) ? raw.rifas : [],
    visitas: raw?.visitas && typeof raw.visitas === 'object' ? raw.visitas : {},
    carga: Array.isArray(raw?.carga) ? raw.carga : [],
    clientes: Array.isArray(raw?.clientes) ? raw.clientes : [],
  }
}

function db(): Db {
  if (cache) return cache
  let fromDisk: Db | null = null
  try {
    // Lectura síncrona (archivo chico, servidor local): así el resto del código sigue siendo simple.
    const xhr = new XMLHttpRequest()
    xhr.open('GET', '/_local/db', false)
    xhr.send()
    if (xhr.status === 200) {
      diskAvailable = true
      const parsed = JSON.parse(xhr.responseText || '{}')
      if (parsed && Object.keys(parsed).length) fromDisk = normalize(parsed)
    }
  } catch { /* sin iniciador: queda la copia del navegador */ }
  let fromMirror: Db | null = null
  try { const m = window.localStorage.getItem(MIRROR); if (m) fromMirror = normalize(JSON.parse(m)) } catch { /* nada */ }
  cache = fromDisk ?? fromMirror ?? structuredClone(EMPTY)
  if (!fromDisk && fromMirror && diskAvailable) persist()
  return cache
}

function persist() {
  if (!cache) return
  const json = JSON.stringify(cache)
  try { window.localStorage.setItem(MIRROR, json) } catch { /* lleno o bloqueado */ }
  if (diskAvailable) queueDiskWrite(json)
}

// Guardado en disco en fila: una escritura por vez y siempre la última versión (así no se pisan).
let writing = false
let pending: string | null = null
function queueDiskWrite(json: string) {
  pending = json
  if (writing) return
  writing = true
  const next = () => {
    const body = pending
    pending = null
    if (body == null) { writing = false; return }
    fetch('/_local/db', { method: 'PUT', headers: { 'content-type': 'application/json' }, body, keepalive: body.length < 60000 })
      .catch(() => {})
      .finally(next)
  }
  next()
}

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
export const savesToDisk = () => { db(); return diskAvailable }

// ---------- Consultas ----------
export function listSubmissions(): LocalSubmission[] {
  return db().consultas
}
export function saveSubmission(kind: string, label: string, data: Record<string, unknown>) {
  const clean = Object.fromEntries(Object.entries(data).filter(([key]) => !['idempotencyKey', 'website', 'rooftopSlug'].includes(key)))
  const item: LocalSubmission = { id: newId(kind.slice(0, 3)), kind, label, createdAt: new Date().toISOString(), status: 'nueva', data: clean, photos: [] }
  db().consultas = [item, ...db().consultas].slice(0, 1000)
  persist()
  return item
}
export function updateSubmission(id: string, patch: Partial<LocalSubmission>) {
  db().consultas = db().consultas.map((item) => (item.id === id ? { ...item, ...patch } : item))
  persist()
}
export function deleteSubmission(id: string) {
  const target = db().consultas.find((item) => item.id === id)
  target?.photos?.forEach(deletePhoto)
  db().consultas = db().consultas.filter((item) => item.id !== id)
  persist()
}

// ---------- Usuarios ----------
const DEFAULT_ADMIN: LocalUser = { id: 'U-ADMIN', name: 'Administrador', username: '123', password: '123', role: 'Administrador', active: true, createdAt: '2026-11-20T00:00:00.000Z' }
export function listUsers(): LocalUser[] {
  return db().usuarios.length ? db().usuarios : [DEFAULT_ADMIN]
}
export function saveUsers(users: LocalUser[]) {
  db().usuarios = users
  persist()
  return true
}
export function checkLogin(username: string, password: string) {
  return listUsers().find((user) => user.active && user.username.trim().toLowerCase() === username.trim().toLowerCase() && user.password === password) ?? null
}

// ---------- Autos (cambios sobre el inventario incluido en la muestra) ----------
export function carChanges(): CarChanges {
  return db().autos
}
export function applyCarChanges(base: LocalCar[]): LocalCar[] {
  const { added, edits, deleted } = db().autos
  const gone = new Set(deleted)
  const defaults = { vin: '', stockNumber: '', trim: '', color: '', mileage: 0, price: 0, status: 'available', condition: 'used', features: [], description: '', images: [], previousPrice: null, usedReport: null, isFeatured: false, progressiveOffer: false, fuelType: null, transmission: null, engine: '' }
  return [...added.map((car) => ({ ...defaults, ...car })), ...base].filter((car) => !gone.has(car.id)).map((car) => (edits[car.id] ? { ...car, ...edits[car.id] } : car))
}
export function saveCar(car: LocalCar) {
  const autos = db().autos
  if (autos.added.some((item) => item.id === car.id)) autos.added = autos.added.map((item) => (item.id === car.id ? car : item))
  else if (car.__new) autos.added = [{ ...car, __new: undefined }, ...autos.added]
  else autos.edits = { ...autos.edits, [car.id]: car }
  persist()
}
export function deleteCar(id: string) {
  const autos = db().autos
  const added = autos.added.find((item) => item.id === id)
  if (added) { (added.images ?? []).forEach((img: any) => deletePhoto(img?.image?.url)); autos.added = autos.added.filter((item) => item.id !== id) }
  else autos.deleted = [...new Set([...autos.deleted, id])]
  persist()
}

// ---------- Fotos ----------
/** Achica la foto (máx. 1600 px, JPG) para que se guarde rápido y ocupe poco. */
export async function shrinkImage(file: Blob, max = 1600): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', 0.82))
  } catch {
    return file
  }
}

/** Guarda una foto en la carpeta "datos/fotos" y devuelve su dirección (/_local/fotos/…). */
export async function savePhoto(file: Blob): Promise<string> {
  db()
  const blob = await shrinkImage(file)
  const name = `${newId('F').toLowerCase()}.jpg`
  if (diskAvailable) {
    const response = await fetch(`/_local/fotos/${name}`, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: blob })
    if (response.ok) return `/_local/fotos/${name}`
  }
  // Sin iniciador: la foto queda dentro de los datos del navegador (más chica).
  const small = await shrinkImage(blob, 900)
  return await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsDataURL(small) })
}
export function deletePhoto(url?: string) {
  if (url && url.startsWith('/_local/fotos/') && diskAvailable) void fetch(url, { method: 'DELETE' }).catch(() => {})
}

/** Enlace a la ficha de un auto. En la muestra local, los autos agregados desde el panel usan una ficha base. */
export function vehicleHref(id: string) {
  if (typeof window !== 'undefined' && id.startsWith('auto-') && isLocalDemo()) {
    const base = (window as unknown as { __ELVIS_TEMPLATE__?: string }).__ELVIS_TEMPLATE__
    if (base) return `/inventory/${base}#${id}`
  }
  return `/inventory/${id}`
}


// ---------- Permisos por rol ----------
export const PERMISSIONS: Array<[string, string]> = [
  ['resumen', 'Ver resumen y balances'], ['consultas', 'Ver y gestionar consultas'], ['clientes', 'Ver clientes'],
  ['autos', 'Publicar y editar autos'], ['ventas', 'Registrar ventas'], ['caja', 'Movimientos y cierre de caja'],
  ['sitio', 'Editar contenido y diseño del sitio'], ['ofertas', 'Ofertas y rifas'], ['usuarios', 'Usuarios y permisos'], ['actividad', 'Ver registro de actividad'],
]
export const ROLES = ['Administrador', 'Gerente de ventas', 'Vendedor', 'Responsable de créditos', 'Administración']
const DEFAULT_PERMS: Record<string, string[]> = {
  Administrador: PERMISSIONS.map(([k]) => k),
  'Gerente de ventas': ['resumen', 'consultas', 'clientes', 'autos', 'ofertas', 'ventas', 'caja', 'actividad'],
  Vendedor: ['consultas', 'clientes', 'autos', 'ventas'],
  'Responsable de créditos': ['consultas', 'clientes'],
  Administración: ['resumen', 'clientes', 'ventas', 'caja', 'actividad'],
}
export function rolePermissions(): Record<string, string[]> {
  return { ...DEFAULT_PERMS, ...db().permisos, Administrador: DEFAULT_PERMS.Administrador }
}
export function saveRolePermissions(perms: Record<string, string[]>) {
  db().permisos = perms
  persist()
}
export function can(user: LocalUser | null, permission: string) {
  return Boolean(user && (rolePermissions()[user.role] ?? []).includes(permission))
}

// ---------- Actividad ----------
export function logActivity(usuario: string, accion: string) {
  db().actividad = [{ id: newId('A'), fecha: new Date().toISOString(), usuario, accion }, ...db().actividad].slice(0, 2000)
  persist()
}
export const listActivity = () => db().actividad

// ---------- Ventas y caja ----------
export const listSales = () => db().ventas
export const listCash = () => db().caja
export const listCloses = () => db().cierres
export function saveSale(sale: Sale, cash?: Omit<CashMove, 'id'>) {
  db().ventas = [sale, ...db().ventas.filter((s) => s.id !== sale.id)]
  if (cash && cash.monto > 0) db().caja = [{ ...cash, id: newId('C') }, ...db().caja]
  persist()
}
export function voidSale(id: string) {
  db().ventas = db().ventas.map((s) => (s.id === id ? { ...s, anulada: true } : s))
  persist()
}
export function addCashMove(move: Omit<CashMove, 'id'>) {
  db().caja = [{ ...move, id: newId('C') }, ...db().caja]
  persist()
}
export function deleteCashMove(id: string) {
  db().caja = db().caja.filter((m) => m.id !== id)
  persist()
}
export function addCashClose(close: Omit<CashClose, 'id'>) {
  db().cierres = [{ ...close, id: newId('Z') }, ...db().cierres]
  persist()
}

// ---------- Contenido y diseño del sitio ----------
export const siteSettings = (): SiteSettings => db().sitio
export function saveSiteSettings(settings: SiteSettings) {
  db().sitio = settings
  persist()
}

// ---------- Respaldo ----------
/** Copia completa de los datos (sin las fotos, que quedan en datos/fotos). */
export function exportAll() {
  return JSON.stringify(db(), null, 2)
}
/** Reemplaza todos los datos por los de un respaldo. */
export function importAll(json: string) {
  const parsed = JSON.parse(json)
  if (!parsed || typeof parsed !== 'object' || !('consultas' in parsed || 'usuarios' in parsed || 'autos' in parsed)) throw new Error('El archivo no es un respaldo de Elvis.')
  cache = normalize(parsed)
  persist()
}


// ---------- Secciones de ofertas ----------
export const offerSections = (): OfferSection[] => db().secciones
export function saveOfferSections(list: OfferSection[]) {
  db().secciones = list
  persist()
}

// ---------- Rifas ----------
export const listRaffles = (): Raffle[] => db().rifas
export function saveRaffle(raffle: Raffle) {
  const list = db().rifas
  const i = list.findIndex((r) => r.id === raffle.id)
  if (i >= 0) list[i] = raffle
  else list.unshift(raffle)
  persist()
}
export function deleteRaffle(id: string) {
  db().rifas = db().rifas.filter((r) => r.id !== id)
  persist()
}
/** Reserva un número desde la web. Devuelve false si ya estaba tomado. */
export function reserveRaffleNumber(raffleId: string, entry: Omit<RaffleEntry, 'estado' | 'fecha'>) {
  const raffle = db().rifas.find((r) => r.id === raffleId)
  if (!raffle || raffle.estado !== 'activa' || raffle.numeros.some((n) => n.numero === entry.numero)) return false
  raffle.numeros.push({ ...entry, estado: 'reservado', fecha: new Date().toISOString() })
  persist()
  return true
}

// ---------- Analítica local (sin servicios externos) ----------
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
/** Cuenta una visita a la página (se guarda en la carpeta "datos"). No cuenta el panel. */
export function logPageView(path: string, loadMs?: number) {
  if (!isLocalDemo() || path.startsWith('/panel')) return
  const d = db()
  const page = path.split('#')[0].split('?')[0].replace(/^\/inventory\/.+/, '/inventory/(auto)') || '/'
  const day = (d.visitas[dayKey()] ??= {})
  day[page] = (day[page] ?? 0) + 1
  if (loadMs && loadMs > 0 && loadMs < 60000) d.carga = [...d.carga.slice(-199), Math.round(loadMs)]
  const keys = Object.keys(d.visitas).sort()
  for (const k of keys.slice(0, Math.max(0, keys.length - 90))) delete d.visitas[k]
  persist()
}
export function analytics(days = 7) {
  const d = db()
  const keys = Array.from({ length: days }, (_, i) => { const x = new Date(); x.setDate(x.getDate() - (days - 1 - i)); return dayKey(x) })
  const perDay = keys.map((k) => ({ day: k, total: Object.values(d.visitas[k] ?? {}).reduce((a, b) => a + b, 0) }))
  const pages: Record<string, number> = {}
  for (const k of keys) for (const [p, n] of Object.entries(d.visitas[k] ?? {})) pages[p] = (pages[p] ?? 0) + n
  const leads = d.consultas.filter((c) => keys.includes(dayKey(new Date(c.createdAt)))).length
  const loads = [...d.carga].sort((a, b) => a - b)
  return { perDay, pages: Object.entries(pages).sort((a, b) => b[1] - a[1]), total: perDay.reduce((a, b) => a + b.total, 0), leads, medianLoad: loads.length ? loads[Math.floor(loads.length / 2)] : null }
}

// ---------- Clientes registrados ----------
export const listClients = (): Client[] => db().clientes
export function saveClient(client: Client) {
  const list = db().clientes
  const i = list.findIndex((c) => c.id === client.id)
  if (i >= 0) list[i] = client
  else list.unshift(client)
  persist()
}
export const clientName = (c: Client) => `${c.nombre} ${c.apellido}`.trim()
/** Ingreso de clientes: con usuario, email o DNI. */
export function checkClientLogin(id: string, password: string) {
  const key = id.trim().toLowerCase()
  return db().clientes.find((c) => c.clave && c.clave === password && [c.usuario, c.email, c.dni].some((x) => x && x.toLowerCase() === key)) ?? null
}
export function findClient(id: string) {
  const key = id.trim().toLowerCase().replace(/\./g, '')
  return db().clientes.find((c) => [c.usuario, c.email, c.dni].some((x) => x && x.toLowerCase() === key)) ?? null
}

/** Guarda un archivo (contrato, PDF o foto) en la carpeta "datos". */
export async function saveFile(file: File): Promise<{ nombre: string; url: string }> {
  db()
  const ext = (/\.([a-z0-9]{1,5})$/i.exec(file.name)?.[1] ?? 'pdf').toLowerCase()
  const name = `${newId('DOC').toLowerCase()}.${ext}`
  if (diskAvailable) {
    const response = await fetch(`/_local/fotos/${name}`, { method: 'PUT', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file })
    if (response.ok) return { nombre: file.name, url: `/_local/fotos/${name}` }
  }
  if (file.size > 1_500_000) throw new Error('Sin el iniciador solo se pueden guardar archivos de hasta 1,5 MB. Abre la muestra con INICIAR-MUESTRA.bat.')
  const url = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsDataURL(file) })
  return { nombre: file.name, url }
}
