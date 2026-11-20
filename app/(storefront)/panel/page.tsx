import type { Metadata } from 'next'
import { LocalPanelPage } from '@/features/storefront/screens/LocalPanelPage'

export const metadata: Metadata = { title: 'Panel', robots: { index: false, follow: false } }

export default function Page() {
  return <LocalPanelPage />
}
