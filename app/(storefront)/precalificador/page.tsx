import type { Metadata } from 'next'
import { PrecalificadorPage } from '@/features/storefront/screens/PrecalificadorPage'

export const metadata: Metadata = {
  title: 'Precalificador',
  description: 'Responde unas preguntas rápidas y un vendedor de Elvis te contacta por WhatsApp con la mejor opción para tu 0 km.',
}

export default function Page() {
  return <PrecalificadorPage />
}
