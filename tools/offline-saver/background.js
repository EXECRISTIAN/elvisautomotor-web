// ---------- Resource fetching (extension privileges bypass page CORS) ----------
async function toDataURL(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(res.status);
  const blob = await res.blob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  const type = blob.type || 'application/octet-stream';
  return { dataUrl: `data:${type};base64,${b64(buf)}`, type, text: /text|css|javascript|json|svg|xml/.test(type) ? new TextDecoder().decode(buf) : null };
}
function b64(buf) { let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(bin); }
const htmlDataUrl = html => 'data:text/html;base64,' + b64(new TextEncoder().encode(html));

// ---------- IndexedDB store for recorded pages (survives service-worker restarts) ----------
const db = new Promise((ok, err) => {
  const r = indexedDB.open('offline-rec', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('pages', { keyPath: 'url' });
  r.onsuccess = () => ok(r.result); r.onerror = () => err(r.error);
});
const tx = async (mode, fn) => { const d = await db; return new Promise((ok, err) => { const t = d.transaction('pages', mode); const q = fn(t.objectStore('pages')); t.oncomplete = () => ok(q?.result); t.onerror = () => err(t.error); }); };

// ---------- Recording state ----------
const getState = async () => (await chrome.storage.local.get('rec')).rec || { on: false, tabs: [], seq: 0 };
const setState = rec => chrome.storage.local.set({ rec });
const badge = async () => {
  const s = await getState(); const n = s.on ? await tx('readonly', st => st.count()) : 0;
  chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
  chrome.action.setBadgeText({ text: s.on ? String(n || '●') : '' });
};
const inFlight = new Set();

async function captureTab(tabId, record) {
  const key = tabId;
  if (inFlight.has(key)) return; inFlight.add(key);
  try {
    await new Promise(r => setTimeout(r, 1200)); // let the page settle / render
    await chrome.scripting.executeScript({ target: { tabId }, func: o => { window.__offlineOpts = o; }, args: [{ noJs: true, scroll: true, record }] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['capture.js'] });
  } catch (e) { console.warn('capture failed', e); }
  finally { inFlight.delete(key); }
}

async function startRecording(tabId) {
  await tx('readwrite', st => st.clear());
  await setState({ on: true, tabs: [tabId], seq: 0, started: Date.now() });
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
      const [u, hash] = dec(href).split('#'); const f = files.get(u);
      return f ? `${pre}${encodeURI(f)}${hash ? '#' + hash : ''}"` : all;
    });
    entries.push([`${folder}/${files.get(p.url)}`, html]);
  }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const index = `<!doctype html><meta charset="utf-8"><title>Grabación offline</title><style>body{font:15px system-ui;max-width:800px;margin:40px auto;padding:0 16px}li{margin:8px 0}small{color:#666}</style><h1>Grabación offline</h1><p>${pages.length} páginas · ${new Date(s.started).toLocaleString()}</p><ol>${pages.map(p => `<li><a href="${encodeURI(files.get(p.url))}">${esc(p.title || p.url)}</a><br><small>${esc(p.url)}</small></li>`).join('')}</ol>`;
  entries.unshift([`${folder}/index.html`, index]);
  const zip = makeZip(entries);
  await chrome.downloads.download({ url: 'data:application/zip;base64,' + b64(zip), filename: `${folder}.zip`, saveAs: true, conflictAction: 'uniquify' });
  await tx('readwrite', st => st.clear());
  return { count: pages.length, folder: folder + '.zip' };
}

// Follow navigations in recorded tabs (full loads + SPA route changes).
chrome.webNavigation.onCompleted.addListener(async d => {
  if (d.frameId !== 0) return; const s = await getState();
  if (s.on && s.tabs.includes(d.tabId)) captureTab(d.tabId, true);
});
chrome.webNavigation.onHistoryStateUpdated.addListener(async d => {
  if (d.frameId !== 0) return; const s = await getState();
  if (s.on && s.tabs.includes(d.tabId)) captureTab(d.tabId, true);
});
// Links opened in new tabs/windows from a recorded tab are recorded too.
chrome.webNavigation.onCreatedNavigationTarget.addListener(async d => {
  const s = await getState();
  if (s.on && s.tabs.includes(d.sourceTabId) && !s.tabs.includes(d.tabId)) { s.tabs.push(d.tabId); await setState(s); }
});
chrome.tabs.onRemoved.addListener(async id => { const s = await getState(); if (s.on) { s.tabs = s.tabs.filter(t => t !== id); await setState(s); } });

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const done = p => { p.then(reply, e => reply({ error: String(e) })); return true; };
  if (msg.type === 'fetch') return done(toDataURL(msg.url));
  if (msg.type === 'captured') {
    if (!msg.record) return done(chrome.downloads.download({ url: htmlDataUrl(msg.html), filename: msg.name, saveAs: true }).then(id => ({ id })));
    return done((async () => {
      const s = await getState(); if (!s.on) return { skipped: true };
      const prev = await tx('readonly', st => st.get(msg.url));
      const seq = prev ? prev.seq : ++s.seq; await setState(s);
      await tx('readwrite', st => st.put({ url: msg.url, title: msg.title, name: msg.name, html: msg.html, seq }));
      badge(); chrome.runtime.sendMessage({ type: 'recUpdate' }).catch(() => {});
      return { ok: true };
    })());
  }
  if (msg.type === 'recStart') return done(startRecording(msg.tabId));
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
    const n = enc.encode(name), data = enc.encode(content), crc = crc32(data);
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
