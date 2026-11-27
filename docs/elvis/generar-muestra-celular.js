// Arma un único HTML autocontenido (sin JS, sin internet) con las páginas principales en formato celular.
// Uso (con la web corriendo en localhost:3000): node docs/elvis/generar-muestra-celular.js docs/elvis/muestra-android/elvis-muestra-celular.html
const { chromium, devices } = require('playwright')
const fs = require('fs')
const BASE = 'http://localhost:3000'
const OUT = process.argv[2]
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ ...devices['Pixel 7'] })
  const p = await ctx.newPage()
  await p.goto(BASE + '/inventory'); await p.waitForTimeout(1500)
  const carId = await p.evaluate(() => (document.querySelector('a[href^="/inventory/"]')?.getAttribute('href') || '').split('/').pop())
  const PAGES = [
    ['inicio', '/', 'Inicio'], ['inventario', '/inventory', 'Inventario'], ['ficha', '/inventory/' + carId, 'Ficha de auto'],
    ['ofertas', '/ofertas', 'Ofertas'], ['financiacion', '/financing', 'Financiación'], ['vende', '/trade-in', 'Vende tu auto'],
    ['nosotros', '/nosotros', 'Nosotros'], ['contacto', '/contact', 'Contacto'],
  ]
  const ROUTES = { '/': 'inicio', '/inventory': 'inventario', '/ofertas': 'ofertas', '/financing': 'financiacion', '/trade-in': 'vende', '/nosotros': 'nosotros', '/contact': 'contacto' }
  const cache = new Map()
  async function dataUri(url) {
    if (cache.has(url)) return cache.get(url)
    const r = await ctx.request.get(new URL(url, BASE).href).catch(() => null)
    let v = ''
    if (r && r.ok()) { const ct = (r.headers()['content-type'] || 'application/octet-stream').split(';')[0]; v = `data:${ct};base64,${(await r.body()).toString('base64')}` }
    cache.set(url, v); return v
  }
  let css = ''
  let htmlCls = '', bodyCls = '', htmlStyle = ''
  const sections = []
  for (const [id, path] of PAGES) {
    await p.goto(BASE + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200)
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)) } scrollTo(0, 0) })
    await p.waitForTimeout(600)
    if (!htmlCls) [htmlCls, bodyCls, htmlStyle] = await p.evaluate(() => [document.documentElement.className, document.body.className, document.documentElement.getAttribute('style') || ''])
    if (!css) css = await p.evaluate(() => [...document.styleSheets].map((s) => { try { const base = s.href || location.href; return [...s.cssRules].map((r) => r.cssText.replace(/url\("?([^")]+)"?\)/g, (a, u) => u.startsWith('data:') ? a : `url("${new URL(u, base).href}")`)).join('\n') } catch { return '' } }).join('\n'))
    const html = await p.evaluate(() => {
      const root = document.querySelector('.storefront') || document.body
      const c = root.cloneNode(true)
      c.querySelectorAll('script,noscript,iframe').forEach((e) => e.remove())
      c.querySelectorAll('img').forEach((img) => { const src = img.currentSrc || img.src; img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.removeAttribute('loading'); img.setAttribute('src', src) })
      c.querySelectorAll('picture source').forEach((s) => s.remove())
      return c.outerHTML
    })
    sections.push([id, html])
  }
  // Imágenes y url() de CSS a data URI.
  const urls = new Set()
  for (const [, h] of sections) for (const m of h.matchAll(/src="([^"]+)"/g)) if (!m[1].startsWith('data:')) urls.add(m[1].replace(/&amp;/g, '&'))
  for (const m of css.matchAll(/url\("?([^")]+)"?\)/g)) if (!m[1].startsWith('data:')) urls.add(m[1])
  for (const u of urls) await dataUri(u)
  const swap = (s) => s.replace(/src="([^"]+)"/g, (all, u) => { const d = cache.get(u.replace(/&amp;/g, '&')); return d ? `src="${d}"` : all })
  css = css.replace(/url\("?([^")]+)"?\)/g, (all, u) => { const d = cache.get(u); return d ? `url("${d}")` : all })
  const link = (h) => h.replace(/href="([^"]*)"/g, (all, u) => {
    if (/^(https?:|mailto:|tel:)/.test(u)) return u.startsWith('http://localhost') ? 'href="#inicio"' : all
    const path = u.split('?')[0].split('#')[0]
    if (path.startsWith('/inventory/')) return 'href="#ficha"'
    if (ROUTES[path]) return `href="#${ROUTES[path]}"`
    return 'href="#inicio"'
  })
  const nav = PAGES.map(([id, , label]) => `<a href="#${id}">${label}</a>`).join('')
  const scope = (h, sid) => {
    // Los degradados SVG (logo) usan ids; cada página necesita los suyos o no se ven en las páginas ocultas.
    const ids = new Set([...h.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]))
    for (const id of ids) { const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); h = h.replace(new RegExp(`id="${esc}"`, 'g'), `id="${id}-${sid}"`).replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${id}-${sid})`) }
    return h
  }
  // El botón ☰ abre un menú hecho solo con CSS (en este archivo no corre el JavaScript del sitio).
  const burger = (h) => h.replace(/<button([^>]*aria-label="Abrir menú"[^>]*)>([\s\S]*?)<\/button>/g, (all, attrs, inner) => `<a href="#mx-menu"${attrs.replace(/\s(type|aria-expanded|aria-controls)="[^"]*"/g, '')}>${inner}</a>`)
  const body = sections.map(([id, h]) => `<section id="${id}" class="mx-pg">${scope(burger(link(swap(h))), id)}</section>`).join('\n')
  const doc = `<!doctype html><html lang="es" class="${htmlCls}" style="${htmlStyle}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Elvis Automotores · Muestra</title><style>${css}
.mx-pg{display:none}.mx-pg:target{display:block}body:not(:has(.mx-pg:target)) #inicio{display:block}
#mx-menu{display:none;position:fixed;inset:0;z-index:200;background:rgba(5,5,5,.97);padding:22px 24px;overflow-y:auto}#mx-menu:target{display:block}
#mx-menu .mx-x{display:block;margin-left:auto;width:44px;height:44px;color:#f3efe7;font:300 34px/44px system-ui,sans-serif;text-align:center;text-decoration:none}
#mx-menu nav a{display:block;padding:16px 4px;border-bottom:1px solid #2a2622;color:#f3efe7;font:600 15px/1.2 Montserrat,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;text-decoration:none}
#mx-menu p{margin-top:22px;color:#8f8b84;font:12px/1.5 system-ui,sans-serif}
.mx-pg header.sticky{position:relative!important}\n.sf-gold-text{background-image:var(--sf-gold-gradient)!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important}
</style></head><body class="${bodyCls}" style="margin:0;background:#0a0908">${body}<div id="mx-menu" role="dialog" aria-label="Menú"><a class="mx-x" href="#inicio" onclick="history.back();return false" aria-label="Cerrar menú">×</a><nav>${nav}</nav><p>Muestra sin internet: se ve el diseño; los formularios no envían datos.</p></div></body></html>`
  fs.writeFileSync(OUT, doc)
  console.log('ok', (doc.length / 1048576).toFixed(1) + ' MB', urls.size, 'recursos')
  await b.close()
})()
