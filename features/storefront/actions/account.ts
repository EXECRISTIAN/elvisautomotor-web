'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { resetPassword } from '@/features/dashboard/actions/auth'
import { openfrontClient } from '../lib/config'
import { getAuthHeaders, removeAuthToken, setAuthToken } from '../lib/data/cookies'

export type AccountState = { error: string | null; success?: string }

export type CustomerProfile = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
}

export async function getCustomer(): Promise<CustomerProfile | null> {
  try {
    const { authenticatedItem } = await openfrontClient.request<{ authenticatedItem: CustomerProfile | null }>(
      `query CustomerAccount { authenticatedItem { ... on User { id name email phone } } }`,
      {},
      await getAuthHeaders()
    )
    return authenticatedItem ?? null
  } catch {
    return null
  }
}

async function authenticate(email: string, password: string) {
  const { authenticateUserWithPassword } = await openfrontClient.request<{
    authenticateUserWithPassword: { sessionToken?: string; message?: string } | null
  }>(
    `mutation CustomerSignin($email: String!, $password: String!) {
      authenticateUserWithPassword(email: $email, password: $password) {
        ... on UserAuthenticationWithPasswordSuccess { sessionToken }
        ... on UserAuthenticationWithPasswordFailure { message }
      }
    }`,
    { email, password }
  )
  return authenticateUserWithPassword?.sessionToken || null
}

export async function signInCustomer(_state: AccountState, data: FormData): Promise<AccountState> {
  const email = String(data.get('email') || '').trim().toLowerCase()
  const password = String(data.get('password') || '')
  if (!email || !password) return { error: 'Ingresá tu email y contraseña.' }
  try {
    const token = await authenticate(email, password)
    if (!token) return { error: 'Email o contraseña incorrectos.' }
    await setAuthToken(token)
  } catch {
    return { error: 'No pudimos iniciar sesión. Intentá de nuevo.' }
  }
  revalidatePath('/account')
  redirect('/account')
}

export async function signUpCustomer(_state: AccountState, data: FormData): Promise<AccountState> {
  const name = String(data.get('name') || '').trim()
  const email = String(data.get('email') || '').trim().toLowerCase()
  const password = String(data.get('password') || '')
  if (process.env.DEMO_MODE === 'true') return { error: 'Sitio de demostración: el registro de clientes está desactivado.' }
  if (!name || !email || !password) return { error: 'Ingresá tu nombre, email y contraseña.' }
  try {
    await openfrontClient.request(
      `mutation RegisterCustomer($name: String!, $email: String!, $password: String!) {
        registerCustomerAccount(name: $name, email: $email, password: $password) { id }
      }`,
      { name, email, password }
    )
  } catch {
    return { error: 'No pudimos crear la cuenta. Si ya tenés una, iniciá sesión.' }
  }
  try {
    const token = await authenticate(email, password)
    if (!token) return { error: 'Cuenta creada. Iniciá sesión para continuar.' }
    await setAuthToken(token)
  } catch {
    return { error: 'Cuenta creada. Iniciá sesión para continuar.' }
  }
  revalidatePath('/account')
  redirect('/account')
}

export async function signOutCustomer() {
  await removeAuthToken()
  revalidatePath('/account')
  redirect('/account')
}

export async function resetCustomerPassword(_state: AccountState, data: FormData): Promise<AccountState> {
  const result = await resetPassword({ message: null, success: null, formData: { email: '' } }, data, data.get('token') ? 'reset' : 'request')
  return { error: 'message' in result ? result.message ?? null : null, success: 'success' in result ? result.success ?? undefined : undefined }
}

async function updateCustomer(data: Record<string, string>, failure: string): Promise<AccountState> {
  const customer = await getCustomer()
  if (!customer) return { error: 'Iniciá sesión para actualizar tu perfil.' }
  try {
    await openfrontClient.request(
      `mutation UpdateCustomer($id: ID!, $data: UserUpdateInput!) {
        updateUser(where: { id: $id }, data: $data) { id }
      }`,
      { id: customer.id, data },
      await getAuthHeaders()
    )
  } catch {
    return { error: failure }
  }
  revalidatePath('/account', 'layout')
  return { error: null, success: 'Guardado' }
}

export async function updateCustomerName(_state: AccountState, data: FormData): Promise<AccountState> {
  const name = String(data.get('name') || '').trim()
  if (!name) return { error: 'Ingresá tu nombre.' }
  return updateCustomer({ name }, 'No pudimos actualizar tu nombre.')
}

export async function updateCustomerEmail(_state: AccountState, data: FormData): Promise<AccountState> {
  const email = String(data.get('email') || '').trim().toLowerCase()
  if (!email) return { error: 'Ingresá tu email.' }
  return updateCustomer({ email }, 'Unable to update your email. It may already be in use.')
}

export async function updateCustomerPhone(_state: AccountState, data: FormData): Promise<AccountState> {
  const phone = String(data.get('phone') || '').trim()
  return updateCustomer({ phone }, 'No pudimos actualizar tu teléfono.')
}

export async function updateCustomerPassword(_state: AccountState, data: FormData): Promise<AccountState> {
  const password = String(data.get('password') || '')
  const confirmPassword = String(data.get('confirmPassword') || '')
  if (!password) return { error: 'Ingresá una nueva contraseña.' }
  if (password !== confirmPassword) return { error: 'Las contraseñas no coinciden.' }
  return updateCustomer({ password }, 'No pudimos actualizar tu contraseña.')
}
