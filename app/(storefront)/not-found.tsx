import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Página no encontrada', robots: { index: false, follow: false } }

export { PageNotFound as default } from '@/features/storefront/components/PageNotFound'
