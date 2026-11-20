'use client'

// Muestra local (sin servidor): los formularios y el panel guardan en el navegador de esta PC.
// Se activa solo cuando la página la sirve el iniciador de la muestra (window.__ELVIS_OFFLINE__).

export type LocalSubmission = { id: string; kind: string; label: string; createdAt: string; status: string; data: Record<string, unknown> }
export type LocalUser = { id: string; name: string; username: string; password: string; role: string; active: boolean; createdAt: string }

const SUBMISSIONS = 'elvis:consultas'
const USERS = 'elvis:usuarios'

export function isLocalDemo() {
  return typeof window !== 'undefined' && (window as unknown as { __ELVIS_OFFLINE__?: boolean }).__ELVIS_OFFLINE__ === true
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()

export function listSubmissions(): LocalSubmission[] {
  return read<LocalSubmission[]>(SUBMISSIONS, [])
}
export function saveSubmission(kind: string, label: string, data: Record<string, unknown>) {
  const clean = Object.fromEntries(Object.entries(data).filter(([key]) => !['idempotencyKey', 'website', 'rooftopSlug'].includes(key)))
  const item: LocalSubmission = { id: newId(kind.slice(0, 3)), kind, label, createdAt: new Date().toISOString(), status: 'nueva', data: clean }
  write(SUBMISSIONS, [item, ...listSubmissions()].slice(0, 500))
  return item
}
export function updateSubmission(id: string, patch: Partial<LocalSubmission>) {
  write(SUBMISSIONS, listSubmissions().map((item) => (item.id === id ? { ...item, ...patch } : item)))
}
export function deleteSubmission(id: string) {
  write(SUBMISSIONS, listSubmissions().filter((item) => item.id !== id))
}

const DEFAULT_ADMIN: LocalUser = { id: 'U-ADMIN', name: 'Administrador', username: '123', password: '123', role: 'Administrador', active: true, createdAt: '2026-11-20T00:00:00.000Z' }
export function listUsers(): LocalUser[] {
  const users = read<LocalUser[]>(USERS, [])
  return users.length ? users : [DEFAULT_ADMIN]
}
export function saveUsers(users: LocalUser[]) {
  return write(USERS, users)
}
export function checkLogin(username: string, password: string) {
  return listUsers().find((user) => user.active && user.username.trim().toLowerCase() === username.trim().toLowerCase() && user.password === password) ?? null
}
