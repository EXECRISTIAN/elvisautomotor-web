'use client'

import { useEffect, useState } from 'react'
import { isLocalDemo, logPageView, siteSettings } from '../lib/localStore'

/** Muestra local: aplica en la web lo editado en el panel → Sitio (textos, aviso y colores). */
export function LocalSiteOverrides() {
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!isLocalDemo()) return
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const record = () => logPageView(location.pathname, nav ? nav.loadEventEnd || nav.domContentLoadedEventEnd : undefined)
    if (document.readyState === 'complete') setTimeout(record, 0)
    else window.addEventListener('load', () => setTimeout(record, 0), { once: true })
    const site = siteSettings()
    setNotice(site.aviso?.trim() || '')
    const root = document.querySelector<HTMLElement>('.storefront')
    if (root && site.colorAcento) {
      root.style.setProperty('--sf-accent', site.colorAcento)
      root.style.setProperty('--sf-accent-fill', site.colorAcento)
      root.style.setProperty('--sf-gold-gradient', `linear-gradient(135deg, ${site.colorAcento} 0%, color-mix(in oklab, ${site.colorAcento} 70%, white) 50%, ${site.colorAcento} 100%)`)
    }
    if (root && site.colorFondo) root.style.setProperty('--sf-paper', site.colorFondo)
    const apply = () => document.querySelectorAll<HTMLElement>('[data-edit]').forEach((el) => {
      const value = site[el.dataset.edit || '']?.trim()
      if (value && el.textContent !== value) el.textContent = value
    })
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  if (!notice) return null
  return (
    <div role="note" className="px-4 py-2 text-center text-[0.85rem] font-semibold" style={{ background: 'var(--sf-gold-gradient)', color: 'var(--sf-accent-ink)' }}>
      {notice}
    </div>
  )
}
