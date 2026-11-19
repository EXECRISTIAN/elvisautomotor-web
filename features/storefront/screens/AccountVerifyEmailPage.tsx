import { getCustomer } from '../actions/account'
import { AccountEmpty, AccountHeader } from '../components/account/AccountStates'
import { VerifyEmailConfirm } from '../components/account/VerifyEmailConfirm'

export async function AccountVerifyEmailPage({ token }: { token: string | null }) {
  const customer = await getCustomer()
  return (
    <section className="max-w-xl pb-24">
      <AccountHeader title="Verificar email" meta={customer?.email ? <span className="break-all">{customer.email}</span> : undefined} />
      <div className="mt-[var(--sf-space-lg)]">
        {token ? <VerifyEmailConfirm token={token} /> : <AccountEmpty>El enlace de verificación está incompleto.</AccountEmpty>}
      </div>
    </section>
  )
}
