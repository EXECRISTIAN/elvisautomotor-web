// Builds the recording zip (can be hundreds of MB) and returns a blob: URL for chrome.downloads.
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m.type !== 'buildZip') return;
  build(m.state).then(reply, e => reply({ error: String(e) }));
  return true;
});

const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function build(s) {
  const pages = (await tx('readonly', st => st.getAll())).sort((a, b) => a.seq - b.seq);
  const raw = (await tx('readonly', st => st.getAll(), 'raw')).sort((a, b) => a.url < b.url ? -1 : 1);
  const assets = await tx('readonly', st => st.getAll(), 'assets');
  const folder = 'Copia-' + new Date(s.started || Date.now()).toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const entries = [];

  // 1. Rendered pages, ready to open offline, with links between them pointing at local copies.
  const files = new Map();
  pages.forEach((p, i) => files.set(p.url, `paginas/${String(i + 1).padStart(3, '0')}-${p.name}`));
  const dec = h => h.replace(/&amp;/g, '&');
  for (const p of pages) {
    const html = p.html.replace(/(<a\b[^>]*?\shref=")([^"]*)"/gi, (all, pre, href) => {
      const [, hash] = dec(href).split('#'); const f = files.get(normUrl(dec(href)));
      return f ? `${pre}${encodeURI(f.slice('paginas/'.length))}${hash ? '#' + hash : ''}"` : all;
    });
    entries.push([`${folder}/${files.get(p.url)}`, html]);
  }
  for (const a of assets) entries.push([`${folder}/paginas/${a.path}`, a.buf]);

  // 2. Original code: every file the browser downloaded, byte for byte, in the site's own folder structure.
  const used = new Set(), list = [['url', 'archivo', 'tipo', 'categoria', 'bytes']];
  // Files the snapshot downloaded itself (e.g. lazy images the browser never requested) belong in the full copy too.
  const seen = new Set(raw.map(r => r.url));
  for (const a of assets) if (/^https?:/.test(a.url) && !seen.has(a.url)) raw.push({ url: a.url, mime: a.type || '', type: 'Extra', buf: a.buf });
  for (const r of raw) {
    let p = 'codigo-original/' + mirrorPath(r.url, r.mime);
    for (let i = 2; used.has(p.toLowerCase()); i++) p = p.replace(/(-\d+)?(\.[^./]+)$/, `-${i}$2`);
    used.add(p.toLowerCase());
    entries.push([`${folder}/${p}`, r.buf]);
    list.push([r.url, p, r.mime, r.type || '', r.buf.length]);
  }
  const csv = list.map(row => row.map(v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(',')).join('\n');
  entries.push([`${folder}/lista-de-archivos.csv`, '﻿' + csv]);

  // 3. Summary page + readme.
  const byType = {}; for (const r of raw) { const k = (r.type || 'Other'); byType[k] = (byType[k] || 0) + 1; }
  const index = `<!doctype html><meta charset="utf-8"><title>Copia del sitio</title><style>body{font:15px system-ui;max-width:860px;margin:40px auto;padding:0 16px;line-height:1.5}li{margin:6px 0}small{color:#666}code{background:#f2f2f2;padding:1px 4px;border-radius:3px}</style>
<h1>Copia del sitio</h1><p>${new Date(s.started).toLocaleString()} · ${pages.length} páginas · ${raw.length} archivos de código original</p>
<h2>Páginas (listas para ver sin internet)</h2><ol>${pages.map(p => `<li><a href="${encodeURI(files.get(p.url))}">${esc(p.title || p.url)}</a><br><small>${esc(p.url)}</small></li>`).join('')}</ol>
<h2>Código original</h2><p>Todo lo que el sitio envió al navegador, sin modificar, en <code>codigo-original/&lt;dominio&gt;/&lt;ruta&gt;</code>. Lista completa con la URL de origen de cada archivo: <a href="lista-de-archivos.csv">lista-de-archivos.csv</a>.</p>
<ul>${Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li>${esc(k)}: ${v}</li>`).join('')}</ul>`;
  entries.unshift([`${folder}/index.html`, index]);
  entries.push([`${folder}/LEEME.txt`, `COPIA DEL SITIO\n\nindex.html             Resumen y lista de páginas.\npaginas/               Cada página tal como se veía, lista para abrir sin internet (sin JavaScript).\npaginas/assets/        Imágenes, fuentes, CSS y medios usados por esas páginas.\ncodigo-original/       Todos los archivos que envió el servidor, sin modificar: HTML, JavaScript, CSS,\n                       JSON de APIs, imágenes, fuentes, videos, etc., organizados por dominio y ruta.\nlista-de-archivos.csv  URL original -> archivo, tipo y tamaño de cada archivo de codigo-original/.\n\nNota: los archivos de codigo-original/ mantienen sus rutas absolutas originales (por ejemplo /assets/app.js),\nasí que para que funcionen como sitio hay que servir la carpeta de cada dominio en la raíz de un servidor web.\n`]);

  const blob = new Blob(zipParts(entries), { type: 'application/zip' });
  return { url: URL.createObjectURL(blob), folder, count: pages.length, raw: raw.length };
}
