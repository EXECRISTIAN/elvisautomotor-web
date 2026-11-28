// Corona de línea fina (propia, sin referencias a terceros).
export function Crown({ className = 'w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="rey-gold" x1="0" y1="0" x2="64" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f6e3a1" /><stop offset=".5" stopColor="#c9a24a" /><stop offset="1" stopColor="#8a6a25" />
        </linearGradient>
      </defs>
      <path d="M6 32 3 10l15 12L32 4l14 18 15-12-3 22Z" stroke="url(#rey-gold)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 36h48" stroke="url(#rey-gold)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="32" cy="4" r="2" fill="url(#rey-gold)" /><circle cx="3" cy="10" r="1.6" fill="url(#rey-gold)" /><circle cx="61" cy="10" r="1.6" fill="url(#rey-gold)" />
    </svg>
  )
}
