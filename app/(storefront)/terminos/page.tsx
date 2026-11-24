import type { Metadata } from 'next'
import { Container } from '@/features/storefront/components/Container'

export const metadata: Metadata = { title: 'Términos y condiciones de uso' }

export default function TerminosPage() {
  return (
    <Container className="py-[var(--sf-space-2xl)]">
      <h1 className="sf-title-line sf-heading text-[length:var(--sf-text-xl)]">
        <span className="sf-dot" aria-hidden="true" />
        Términos y condiciones de uso
      </h1>
      <p className="sf-copy mt-4">Texto en preparación.</p>
    </Container>
  )
}
