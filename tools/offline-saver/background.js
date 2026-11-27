// Canonical page URL: no hash, no tracking params (_gl, utm_*, gclid…), no trailing slash.
const normUrl = u => { try { const x = new URL(u); x.hash = '';
  [...x.searchParams.keys()].forEach(k => { if (/^(_gl|_ga|_gac|_gid|utm_.*|gclid|gbraid|wbraid|fbclid|msclkid|dclid|yclid|mc_cid|mc_eid|_hsenc|_hsmi|ref_src)$/i.test(k)) x.searchParams.delete(k); });
  x.search = x.searchParams.toString() ? '?' + x.searchParams : ''; if (x.pathname.length > 1) x.pathname = x.pathname.replace(/\/+$/, '');
  return x.href; } catch { return u; } };
// ---------- Resource fetching (extension privileges bypass page CORS) ----------
async function toDataURL(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(res.status);
  const blob = await res.blob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  const type = blob.type || 'application/octet-stream';
  const text = /text|css|javascript|json|svg|xml/.test(type) ? new TextDecoder().decode(buf) : null;
  return { buf, type, text };
}
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif', 'image/svg+xml': 'svg', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'font/woff2': 'woff2', 'font/woff': 'woff', 'font/ttf': 'ttf', 'font/otf': 'otf', 'text/css': 'css', 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3' };
function assetPath(url, type) {
  let base = 'file', ext = EXT[type.split(';')[0]];
  try { const last = decodeURIComponent(new URL(url).pathname.split('/').pop() || ''); const m = last.match(/^(.*?)(?:\.([a-z0-9]{1,5}))?$/i); if (m[1]) base = m[1]; if (!ext && m[2]) ext = m[2].toLowerCase(); } catch {}
  base = base.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'file';
  const dir = /css/.test(type) ? 'css' : /^image/.test(type) ? 'img' : /font/.test(type) || /^(woff2?|ttf|otf|eot)$/.test(ext) ? 'fonts' : /^(video|audio)/.test(type) ? 'media' : 'other';
  return `assets/${dir}/${base}-${crc32(new TextEncoder().encode(url)).toString(16)}${ext ? '.' + ext : ''}`;
}
async function fetchResource(url, store) {
  if (store) { const have = await tx('readonly', st => st.get(url), 'assets'); if (have) return { path: have.path, type: have.type, text: have.text }; }
  const r = await toDataURL(url);
  if (!store) return { dataUrl: `data:${r.type};base64,${b64(r.buf)}`, type: r.type, text: r.text };
  if (/css/.test(r.type)) return { type: r.type, text: r.text }; // CSS is processed and stored via storeText
  const path = assetPath(url, r.type);
  await tx('readwrite', st => st.put({ url, path, buf: r.buf, type: r.type, text: r.text }), 'assets');
  return { path, type: r.type, text: r.text };
}
function b64(buf) { let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(bin); }
const htmlDataUrl = html => 'data:text/html;base64,' + b64(new TextEncoder().encode(html));

// ---------- IndexedDB store for recorded pages (survives service-worker restarts) ----------
const db = new Promise((ok, err) => {
  const r = indexedDB.open('offline-rec', 2);
  r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('pages')) d.createObjectStore('pages', { keyPath: 'url' }); if (!d.objectStoreNames.contains('assets')) d.createObjectStore('assets', { keyPath: 'url' }); };
  r.onsuccess = () => ok(r.result); r.onerror = () => err(r.error);
});
const tx = async (mode, fn, store = 'pages') => { const d = await db; return new Promise((ok, err) => { const t = d.transaction(store, mode); const q = fn(t.objectStore(store)); t.oncomplete = () => ok(q?.result); t.onerror = () => err(t.error); }); };

// ---------- Recording state ----------
const getState = async () => (await chrome.storage.local.get('rec')).rec || { on: false, tabs: [], seq: 0 };
const setState = rec => chrome.storage.local.set({ rec });
const badge = async () => {
  const s = await getState(); const n = s.on ? await tx('readonly', st => st.count()) : 0;
  chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
  chrome.action.setBadgeText({ text: s.on ? String(n || '●') : '' });
};
const inFlight = new Set(), pending = new Set(), lastSig = new Map(); // tabId → content signature of the last capture

async function captureTab(tabId, record, spa) {
  const key = tabId;
  if (inFlight.has(key)) { pending.add(key); return; } inFlight.add(key);
  try {
    if (record) { const t = await chrome.tabs.get(tabId); if (await tx('readonly', st => st.get(normUrl(t.url)))) return; }
    await new Promise(r => setTimeout(r, 400));
    await chrome.scripting.executeScript({ target: { tabId }, func: o => { window.__offlineOpts = o; }, args: [{ noJs: true, prevSig: spa ? lastSig.get(tabId) : null, record, files: record && (await getState()).files !== false }] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['capture.js'] });
  } catch (e) { console.warn('capture failed', e); }
  finally { inFlight.delete(key); if (pending.delete(key)) captureTab(tabId, record, true); } // navigated mid-capture → capture the new page too
}

async function startRecording(tabId, files) {
  await tx('readwrite', st => st.clear()); await tx('readwrite', st => st.clear(), 'assets');
  await setState({ on: true, tabs: [tabId], seq: 0, started: Date.now(), files });
  badge(); captureTab(tabId, true);
}

async function stopRecording() {
  const s = await getState(); await setState({ on: false, tabs: [], seq: 0 }); badge();
  const pages = (await tx('readonly', st => st.getAll())).sort((a, b) => a.seq - b.seq);
  if (!pages.length) return { count: 0 };
  const folder = 'Grabacion-' + new Date(s.started || Date.now()).toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const files = new Map();
  pages.forEach((p, i) => files.set(p.url, `${String(i + 1).padStart(3, '0')}-${p.name}`));
  const dec = h => h.replace(/&amp;/g, '&');
  const entries = [];
  for (const p of pages) {
    // Point links to other recorded pages at their local copies.
    const html = p.html.replace(/(<a\b[^>]*?\shref=")([^"]*)"/gi, (all, pre, href) => {
      const [, hash] = dec(href).split('#'); const f = files.get(normUrl(dec(href)));
      return f ? `${pre}${encodeURI(f)}${hash ? '#' + hash : ''}"` : all;
    });
    entries.push([`${folder}/${files.get(p.url)}`, html]);
  }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const index = `<!doctype html><meta charset="utf-8"><title>Grabación offline</title><style>body{font:15px system-ui;max-width:800px;margin:40px auto;padding:0 16px}li{margin:8px 0}small{color:#666}</style><h1>Grabación offline</h1><p>${pages.length} páginas · ${new Date(s.started).toLocaleString()}</p><ol>${pages.map(p => `<li><a href="${encodeURI(files.get(p.url))}">${esc(p.title || p.url)}</a><br><small>${esc(p.url)}</small></li>`).join('')}</ol>`;
  entries.unshift([`${folder}/index.html`, index]);
  for (const a of await tx('readonly', st => st.getAll(), 'assets')) entries.push([`${folder}/${a.path}`, a.buf]);
  const zip = makeZip(entries);
  await chrome.downloads.download({ url: 'data:application/zip;base64,' + b64(zip), filename: `${folder}.zip`, saveAs: true, conflictAction: 'uniquify' });
  await tx('readwrite', st => st.clear()); await tx('readwrite', st => st.clear(), 'assets');
  return { count: pages.length, folder: folder + '.zip' };
}

// Follow navigations in recorded tabs (full loads + SPA route changes).
chrome.webNavigation.onCompleted.addListener(async d => {
  if (d.frameId !== 0) return; const s = await getState();
  if (s.on && s.tabs.includes(d.tabId)) captureTab(d.tabId, true);
});
chrome.webNavigation.onHistoryStateUpdated.addListener(async d => {
  if (d.frameId !== 0) return; const s = await getState();
  if (s.on && s.tabs.includes(d.tabId)) captureTab(d.tabId, true, true);
});
// Links opened in new tabs/windows from a recorded tab are recorded too.
chrome.webNavigation.onCreatedNavigationTarget.addListener(async d => {
  const s = await getState();
  if (s.on && s.tabs.includes(d.sourceTabId) && !s.tabs.includes(d.tabId)) { s.tabs.push(d.tabId); await setState(s); }
});
chrome.tabs.onRemoved.addListener(async id => { const s = await getState(); if (s.on) { s.tabs = s.tabs.filter(t => t !== id); await setState(s); } });

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const done = p => { p.then(reply, e => reply({ error: String(e) })); return true; };
  if (msg.type === 'storeText') return done((async () => {
    const key = 'css:' + msg.key, have = await tx('readonly', st => st.get(key), 'assets');
    if (have) return { path: have.path };
    const path = msg.key.startsWith('inline:') ? `assets/css/estilos-${msg.key.slice(7)}.css` : assetPath(msg.key, 'text/css').replace(/\.css$/, '') + '.css';
    await tx('readwrite', st => st.put({ url: key, path, buf: new TextEncoder().encode(msg.text) }), 'assets');
    return { path };
  })());
  if (msg.type === 'fetch') return done(fetchResource(msg.url, msg.store));
  if (msg.type === 'captured') {
    if (!msg.record) return done(chrome.downloads.download({ url: htmlDataUrl(msg.html), filename: msg.name, saveAs: true }).then(id => ({ id })));
    return done((async () => {
      const s = await getState(); if (!s.on) return { skipped: true };
      msg.url = normUrl(msg.url); if (sender.tab) lastSig.set(sender.tab.id, msg.sig); const prev = await tx('readonly', st => st.get(msg.url));
      const seq = prev ? prev.seq : ++s.seq; await setState(s);
      await tx('readwrite', st => st.put({ url: msg.url, title: msg.title, name: msg.name, html: msg.html, seq }));
      badge(); chrome.runtime.sendMessage({ type: 'recUpdate' }).catch(() => {});
      return { ok: true };
    })());
  }
  if (msg.type === 'recStart') return done(startRecording(msg.tabId, msg.files));
  if (msg.type === 'recStop') return done(stopRecording());
  if (msg.type === 'recStatus') return done((async () => ({ ...(await getState()), count: await tx('readonly', st => st.count()) }))());
});
chrome.runtime.onStartup.addListener(badge);

// ---------- Minimal ZIP writer (stored, no compression) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = ~0; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return ~c >>> 0; };
function makeZip(entries) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)), dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate());
  for (const [name, content] of entries) {
    const n = enc.encode(name), data = typeof content === 'string' ? enc.encode(content) : content, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, dt, 2], [12, dd, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, n.length, 2], [28, 0, 2]].forEach(([o, v, s]) => s === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true));
    const c = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, dt, 2], [14, dd, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, n.length, 2], [42, off, 4]].forEach(([o, v, s]) => s === 4 ? c.setUint32(o, v, true) : c.setUint16(o, v, true));
    parts.push(new Uint8Array(h.buffer), n, data); central.push(new Uint8Array(c.buffer), n);
    off += 30 + n.length + data.length;
  }
  const csize = central.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [8, entries.length, 2], [10, entries.length, 2], [12, csize, 4], [16, off, 4]].forEach(([o, v, s]) => s === 4 ? e.setUint32(o, v, true) : e.setUint16(o, v, true));
  const all = [...parts, ...central, new Uint8Array(e.buffer)], out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let p = 0; for (const a of all) { out.set(a, p); p += a.length; } return out;
}
