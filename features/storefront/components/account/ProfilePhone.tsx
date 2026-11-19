'use client'

import { updateCustomerPhone, type CustomerProfile } from '../../actions/account'
import { ProfileField } from './ProfileField'

export function ProfilePhone({ customer }: { customer: CustomerProfile }) {
  return (
    <ProfileField title="Teléfono" action={updateCustomerPhone}>
      <div>
        <label htmlFor="profile-phone" className="sf-label">Teléfono</label>
        <input id="profile-phone" name="phone" type="tel" autoComplete="tel" defaultValue={customer.phone || ''} className="sf-input" />
      </div>
    </ProfileField>
  )
}
