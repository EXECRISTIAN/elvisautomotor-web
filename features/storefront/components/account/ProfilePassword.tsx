'use client'

import { updateCustomerPassword } from '../../actions/account'
import { ProfileField } from './ProfileField'

export function ProfilePassword() {
  return (
    <ProfileField title="Contraseña" action={updateCustomerPassword}>
      <div>
        <label htmlFor="profile-password" className="sf-label">Nueva contraseña</label>
        <input id="profile-password" name="password" type="password" autoComplete="new-password" required minLength={8} className="sf-input" />
      </div>
      <div>
        <label htmlFor="profile-confirm-password" className="sf-label">Repetí la nueva contraseña</label>
        <input id="profile-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} className="sf-input" />
      </div>
    </ProfileField>
  )
}
