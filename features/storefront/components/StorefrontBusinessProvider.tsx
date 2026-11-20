'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { isLocalDemo, siteSettings } from '../lib/localStore'
import { createStorefrontBusiness, type StorefrontBusiness } from '../lib/business'

const FALLBACK_BUSINESS = createStorefrontBusiness()

const StorefrontBusinessContext = createContext<StorefrontBusiness>(FALLBACK_BUSINESS)

export function StorefrontBusinessProvider({
  business,
  children,
}: {
  business: StorefrontBusiness
  children: ReactNode
}) {
  // Muestra local: los datos de contacto editados en el panel (Sitio) reemplazan a los cargados.
  const [value, setValue] = useState(business)
  useEffect(() => {
    if (!isLocalDemo()) return
    const site = siteSettings()
    const phone = site.telefono?.trim()
    setValue({
      ...business,
      ...(phone ? { phoneDisplay: phone, phoneHref: `tel:+54${phone.replace(/\D/g, '').replace(/^0/, '')}` } : {}),
      ...(site.whatsapp?.trim() ? { whatsappNumber: site.whatsapp.replace(/\D/g, '') } : {}),
      ...(site.email?.trim() ? { salesEmail: site.email.trim() } : {}),
      ...(site.direccion?.trim() ? { addressLine1: site.direccion.trim() } : {}),
      ...(site.localidad?.trim() ? { addressLine2: site.localidad.trim() } : {}),
      ...(site.horarioSemana?.trim() ? { hoursMonFri: site.horarioSemana.trim() } : {}),
      ...(site.horarioSabado?.trim() ? { hoursSaturday: site.horarioSabado.trim() } : {}),
    })
  }, [business])
  return (
    <StorefrontBusinessContext.Provider value={value}>
      {children}
    </StorefrontBusinessContext.Provider>
  )
}

export function useStorefrontBusiness() {
  return useContext(StorefrontBusinessContext)
}
