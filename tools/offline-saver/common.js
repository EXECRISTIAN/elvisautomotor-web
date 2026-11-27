// Shared by the service worker (importScripts) and the offscreen zip builder (<script>).

// Canonical page URL: no hash, no tracking params (_gl, utm_*, gclid…), no trailing slash.
const normUrl = u => { try { const x = new URL(u); x.hash = '';
  [...x.searchParams.keys()].forEach(k => { if (/^(_gl|_ga|_gac|_gid|utm_.*|gclid|gbraid|wbraid|fbclid|msclkid|dclid|yclid|mc_cid|mc_eid|_hsenc|_hsmi|ref_src)$/i.test(k)) x.searchParams.delete(k); });
  x.search = x.searchParams.toString() ? '?' + x.searchParams : ''; if (x.pathname.length > 1) x.pathname = x.pathname.replace(/\/+$/, '');
  return x.href; } catch { return u; } };

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = ~0; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return ~c >>> 0; };
const hex = s => crc32(new TextEncoder().encode(s)).toString(16);

// ---------- IndexedDB: pages (rendered snapshots), assets (snapshot files), raw (every network response) ----------
const db = new Promise((ok, err) => {
  const r = indexedDB.open('offline-rec', 3);
  r.onupgradeneeded = () => { const d = r.result; for (const n of ['pages', 'assets', 'raw']) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath: 'url' }); };
  r.onsuccess = () => ok(r.result); r.onerror = () => err(r.error);
});
const tx = async (mode, fn, store = 'pages') => { const d = await db; return new Promise((ok, err) => { const t = d.transaction(store, mode); const q = fn(t.objectStore(store)); t.oncomplete = () => ok(q?.result); t.onerror = () => err(t.error); }); };
const clearAll = () => Promise.all(['pages', 'assets', 'raw'].map(n => tx('readwrite', st => st.clear(), n)));

// ---------- Original-code mirror: URL → "host/path/file.ext" ----------
const MIME_EXT = { 'text/html': 'html', 'application/xhtml+xml': 'html', 'text/css': 'css', 'application/javascript': 'js', 'text/javascript': 'js', 'application/x-javascript': 'js', 'application/json': 'json', 'application/ld+json': 'json', 'application/manifest+json': 'json', 'text/plain': 'txt', 'application/xml': 'xml', 'text/xml': 'xml', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif', 'image/svg+xml': 'svg', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'font/woff2': 'woff2', 'font/woff': 'woff', 'font/ttf': 'ttf', 'font/otf': 'otf', 'application/font-woff': 'woff', 'application/wasm': 'wasm', 'application/pdf': 'pdf', 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'text/vtt': 'vtt', 'application/vnd.apple.mpegurl': 'm3u8', 'application/dash+xml': 'mpd' };
function mirrorPath(url, mime = '') {
  const u = new URL(url);
  const clean = x => { try { x = decodeURIComponent(x); } catch {} return x.replace(/[<>:"\\|?*\x00-\x1f]/g, '_').replace(/^\.+$/, '_').slice(0, 120); };
  const segs = u.pathname.split('/').map(clean);
  let file = segs.pop() || 'index';
  const m = file.match(/^(.*?)(\.[a-z0-9]{1,8})?$/i); let base = m[1] || 'index', ext = m[2] || '';
  const mext = MIME_EXT[mime.split(';')[0].trim().toLowerCase()];
  if (!ext) ext = '.' + (mext || 'bin');
  if (u.search) base += '-q' + hex(u.search);
  return [u.host.replace(/:/g, '_'), ...segs.filter(Boolean), base + ext].join('/');
}

// ---------- ZIP writer (stored, no compression). Returns parts, so large archives never need one giant buffer. ----------
function zipParts(entries) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)), dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate());
  const put = (view, fields) => fields.forEach(([o, v, s]) => s === 4 ? view.setUint32(o, v, true) : view.setUint16(o, v, true));
  for (const [name, content] of entries) {
    const n = enc.encode(name), data = typeof content === 'string' ? enc.encode(content) : content, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    put(h, [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, dt, 2], [12, dd, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, n.length, 2], [28, 0, 2]]);
    const c = new DataView(new ArrayBuffer(46));
    put(c, [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, dt, 2], [14, dd, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, n.length, 2], [42, off, 4]]);
    parts.push(new Uint8Array(h.buffer), n, data); central.push(new Uint8Array(c.buffer), n);
    off += 30 + n.length + data.length;
  }
  const csize = central.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
  put(e, [[0, 0x06054b50, 4], [8, entries.length, 2], [10, entries.length, 2], [12, csize, 4], [16, off, 4]]);
  return [...parts, ...central, new Uint8Array(e.buffer)];
}
