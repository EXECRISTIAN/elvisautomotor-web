'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'

import { signInCustomer, signUpCustomer, type AccountState } from '../actions/account'

const INITIAL: AccountState = { error: null }

export function LoginPage() {
  const [view, setView] = useState<'signin' | 'signup'>('signin')
  const [signinState, signinAction, signinPending] = useActionState(signInCustomer, INITIAL)
  const [signupState, signupAction, signupPending] = useActionState(signUpCustomer, INITIAL)

  return (
    <section className="w-full max-w-sm">
      <h1 className="sf-display text-center text-[length:var(--sf-text-2xl)]">
        {view === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
      </h1>

      <div role="group" aria-label="Acceso a tu cuenta" className="sf-track sf-track-block mt-6">
        <button type="button" onClick={() => setView('signin')} aria-pressed={view === 'signin'} className="sf-pill min-h-11">
          Iniciar sesión
        </button>
        <button type="button" onClick={() => setView('signup')} aria-pressed={view === 'signup'} className="sf-pill min-h-11">
          Crear cuenta
        </button>
      </div>

      <div className="sf-panel mt-5 p-5 sm:p-6">
        {view === 'signin' ? (
          <form action={signinAction} className="space-y-4">
            <div>
              <label htmlFor="signin-email" className="sf-label">Email o usuario</label>
              <input id="signin-email" name="email" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required className="sf-input" />
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="signin-password" className="sf-label">Contraseña</label>
                <Link href="/account/reset" className="sf-link -my-3 inline-flex min-h-11 items-center text-[length:var(--sf-text-xs)]">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <input id="signin-password" name="password" type="password" autoComplete="current-password" required className="sf-input" />
            </div>
            {signinState.error && <div role="alert" className="sf-notice" data-tone="bad">{signinState.error}</div>}
            <button type="submit" disabled={signinPending} className="sf-btn sf-btn-primary w-full">
              {signinPending ? 'Ingresando…' : 'Iniciar sesión'}
            </button>
          </form>
        ) : (
          <form action={signupAction} className="space-y-4">
            <div>
              <label htmlFor="signup-name" className="sf-label">Nombre completo</label>
              <input id="signup-name" name="name" autoComplete="name" required maxLength={200} className="sf-input" />
            </div>
            <div>
              <label htmlFor="signup-email" className="sf-label">Email</label>
              <input id="signup-email" name="email" type="email" autoComplete="email" required className="sf-input" />
            </div>
            <div>
              <label htmlFor="signup-password" className="sf-label">Contraseña</label>
              <input id="signup-password" name="password" type="password" autoComplete="new-password" required minLength={8} className="sf-input" />
            </div>
            {signupState.error && <div role="alert" className="sf-notice" data-tone="bad">{signupState.error}</div>}
            <button type="submit" disabled={signupPending} className="sf-btn sf-btn-primary w-full">
              {signupPending ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
