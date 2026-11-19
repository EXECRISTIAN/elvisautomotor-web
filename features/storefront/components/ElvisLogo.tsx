// Imagotipo Elvis Automotores: isotipo AE (redibujado del monograma original) + barra + logotipo.
// Es un único SVG embebido en el HTML: no genera descargas extra y las piezas no se separan.
// El texto usa la tipografía del sitio (Montserrat), ya cargada por el layout.

const GOLD_STOPS = (
  <>
    <stop offset="0" stopColor="#F3D58A" />
    <stop offset="0.45" stopColor="#C9A04A" />
    <stop offset="0.75" stopColor="#E8C46F" />
    <stop offset="1" stopColor="#9C7428" />
  </>
)

/** Trazos del isotipo AE en un cuadro de 70 × 100 (A en arco, travesaño continuo y E). */
export const AE_PATHS = ['M7.4 100V12.75a12.75 12.75 0 0 1 25.5 0V100', 'M0 57.5h69.9', 'M69.9 0H46.6v100h23.3']

function Isotype({ gradientId }: { gradientId: string }) {
  return (
    <g stroke={`url(#${gradientId})`} strokeWidth="2.6" fill="none">
      {AE_PATHS.map((d) => <path key={d} d={d} />)}
    </g>
  )
}

export function ElvisLogo({ variant = 'full', className, title = 'Elvis Automotores' }: { variant?: 'full' | 'mark'; className?: string; title?: string }) {
  const id = `elv-gold-${variant}`
  if (variant === 'mark') {
    return (
      <svg viewBox="-2 -2 74 104" className={className} role="img" aria-label={title}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="70" y2="100" gradientUnits="userSpaceOnUse">{GOLD_STOPS}</linearGradient></defs>
        <Isotype gradientId={id} />
      </svg>
    )
  }
  return (
    <svg viewBox="-2 -2 364 104" className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="70" y2="100" gradientUnits="userSpaceOnUse">{GOLD_STOPS}</linearGradient>
        <linearGradient id={`${id}-t`} x1="122" y1="0" x2="352" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F3D58A" /><stop offset="0.5" stopColor="#C9A04A" /><stop offset="1" stopColor="#E8C46F" />
        </linearGradient>
      </defs>
      <Isotype gradientId={id} />
      <path d="M95 8v84" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" />
      <g style={{ fontFamily: 'var(--font-storefront-display), Montserrat, "Helvetica Neue", Arial, sans-serif' }}>
        <text x="120" y="56" fontSize="45" fontWeight="600" fill="#F7F5F0" textLength="196" lengthAdjust="spacing">ELVIS</text>
        <text x="122" y="91" fontSize="16.5" fontWeight="500" fill={`url(#${id}-t)`} textLength="230" lengthAdjust="spacing">AUTOMOTORES</text>
      </g>
    </svg>
  )
}
