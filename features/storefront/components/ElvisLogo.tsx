'use client'

import { useId } from 'react'

// Imagotipo Elvis Automotores: isotipo AE original (vectorizado tal cual: trazos, espacios y colores
// neón del monograma original) + barra + logotipo. Es un único SVG embebido en el HTML: no genera
// descargas extra y las piezas no se separan. El texto usa Montserrat, ya cargada por el sitio.

/** Trazos del isotipo en las coordenadas del original (lienzo de 160 × 160). */
export const AE_ORIGINAL_PATH = 'M60.58 118V53a8 8 0 0 1 16 0V118M53.4 86.7H77.95M105.6 45.6H88.58V116.6H105.6M81.2 86.7H105.6'
export const AE_CORE = '#FFF459'
export const AE_GLOW = '#E83000'

function Isotype({ filterId }: { filterId: string }) {
  return (
    <>
      <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.8" /></filter>
      </defs>
      <g fill="none" strokeLinejoin="miter">
        <path d={AE_ORIGINAL_PATH} stroke={AE_GLOW} strokeWidth="4.3" opacity="0.65" filter={`url(#${filterId})`} />
        <path d={AE_ORIGINAL_PATH} stroke={AE_CORE} strokeWidth="2.35" />
      </g>
    </>
  )
}

export function ElvisLogo({ variant = 'full', className, title = 'Elvis Automotores' }: { variant?: 'full' | 'mark'; className?: string; title?: string }) {
  const uid = useId().replace(/:/g, '')
  if (variant === 'mark') {
    return (
      <svg viewBox="50 41 60 80" className={className} {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}>
        <Isotype filterId={`${uid}-glow`} />
      </svg>
    )
  }
  return (
    <svg viewBox="-2 -2 364 104" className={className} {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}>
      <defs>
        <linearGradient id={`${uid}-t`} x1="122" y1="0" x2="352" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F3D58A" /><stop offset="0.5" stopColor="#C9A04A" /><stop offset="1" stopColor="#E8C46F" />
        </linearGradient>
      </defs>
      {/* Isotipo original, recortado a su zona útil y escalado a la altura del logotipo. */}
      <svg x="0" y="0" width="75" height="100" viewBox="50 41 60 80" overflow="visible">
        <Isotype filterId={`${uid}-glow`} />
      </svg>
      <path d="M95 8v84" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" />
      <g style={{ fontFamily: 'var(--font-storefront-display), Montserrat, "Helvetica Neue", Arial, sans-serif' }}>
        <text x="120" y="56" fontSize="45" fontWeight="600" fill="#F7F5F0" textLength="196" lengthAdjust="spacing">ELVIS</text>
        <text x="122" y="91" fontSize="16.5" fontWeight="500" fill={`url(#${uid}-t)`} textLength="230" lengthAdjust="spacing">AUTOMOTORES</text>
      </g>
    </svg>
  )
}
