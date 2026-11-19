import type { Metadata } from 'next'

import { LoginPage } from '@/features/storefront/screens/LoginPage'

export const metadata: Metadata = { title: 'Iniciar sesión' }

export default function Default() {
  return <LoginPage />
}
