import { redirect } from 'next/navigation'

// Elvis Automotores no ofrece taller: la página de servicio de Openfront redirige a Contacto.
// La pantalla original sigue en features/storefront/screens/ServicePage.tsx por si se habilita.
export default function Page() {
  redirect('/contact')
}
