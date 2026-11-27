importScripts('common.js');

// ---------- Resource fetching for the rendered snapshot (extension privileges bypass page CORS) ----------
async function fetchBytes(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(res.status);
  const blob = await res.blob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  const type = blob.type || 'application/octet-stream';
  const text = /text|css|javascript|json|svg|xml/.test(type) ? new TextDecoder().decode(buf) : null;
  return { buf, type, text };
}
function assetPath(url, type) {
  let base = 'file', ext = MIME_EXT[type.split(';')[0]];
  try { const last = decodeURIComponent(new URL(url).pathname.split('/').pop() || ''); const m = last.match(/^(.*?)(?:\.([a-z0-9]{1,5}))?$/i); if (m[1]) base = m[1]; if (!ext && m[2]) ext = m[2].toLowerCase(); } catch {}
  base = base.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'file';
  const dir = /css/.test(type) ? 'css' : /^image/.test(type) ? 'img' : /font/.test(type) || /^(woff2?|ttf|otf|eot)$/.test(ext) ? 'fonts' : /^(video|audio)/.test(type) ? 'media' : 'other';
  return `assets/${dir}/${base}-${hex(url)}${ext ? '.' + ext : ''}`;
}
async function fetchResource(url, store) {
  if (store) { const have = await tx('readonly', st => st.get(url), 'assets'); if (have) return { path: have.path, type: have.type, text: have.text }; }
  const r = await fetchBytes(url);
  if (!store) return { dataUrl: `data:${r.type};base64,${b64(r.buf)}`, type: r.type, text: r.text };
  if (/css/.test(r.type)) return { type: r.type, text: r.text }; // CSS is processed and stored via storeText
  const path = assetPath(url, r.type);
  await tx('readwrite', st => st.put({ url, path, buf: r.buf, type: r.type, text: r.text }), 'assets');
  return { path, type: r.type, text: r.text };
}
function b64(buf) { let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(bin); }
const unb64 = s => { const bin = atob(s), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
const htmlDataUrl = html => 'data:text/html;base64,' + b64(new TextEncoder().encode(html));

// ---------- Recording state ----------
const getState = async () => (await chrome.storage.local.get('rec')).rec || { on: false, tabs: [], seq: 0 };
const setState = rec => chrome.storage.local.set({ rec });
const counts = async () => ({ count: await tx('readonly', st => st.count()), raw: await tx('readonly', st => st.count(), 'raw') });
const badge = async () => {
  const s = await getState(); const n = s.on ? (await counts()).count : 0;
  chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
  chrome.action.setBadgeText({ text: s.on ? String(n || '●') : '' });
};
const notify = () => { badge(); chrome.runtime.sendMessage({ type: 'recUpdate' }).catch(() => {}); };

// ---------- Full copy: record every network response of recorded tabs via the DevTools protocol ----------
const reqInfo = new Map(); // "tabId:requestId" → response metadata
async function attach(tabId) {
  try { await chrome.debugger.attach({ tabId }, '1.3'); }
  catch (e) { if (!/already attached/i.test(e.message)) { console.warn('debugger attach failed', e); return false; } }
  await chrome.debugger.sendCommand({ tabId }, 'Network.enable', { maxResourceBufferSize: 200e6, maxTotalBufferSize: 1000e6 });
  await chrome.debugger.sendCommand({ tabId }, 'Network.setCacheDisabled', { cacheDisabled: true });
  return true;
}
const detach = tabId => chrome.debugger.detach({ tabId }).catch(() => {});
chrome.debugger.onEvent.addListener((src, method, p) => {
  if (!src.tabId) return; const k = src.tabId + ':' + p.requestId;
  if (method === 'Network.responseReceived') reqInfo.set(k, { url: p.response.url, mime: p.response.mimeType || '', status: p.response.status, type: p.type });
  else if (method === 'Network.loadingFailed') reqInfo.delete(k);
  else if (method === 'Network.loadingFinished') { const r = reqInfo.get(k); reqInfo.delete(k); if (r) saveRaw(src.tabId, p.requestId, r); }
});
let rawTick = 0;
async function saveRaw(tabId, requestId, r) {
  if (!/^https?:/.test(r.url) || r.status < 200 || r.status >= 400 || r.status === 204) return;
  try {
    const b = await chrome.debugger.sendCommand({ tabId }, 'Network.getResponseBody', { requestId });
    const buf = b.base64Encoded ? unb64(b.body) : new TextEncoder().encode(b.body);
    await tx('readwrite', st => st.put({ url: r.url, mime: r.mime, type: r.type, status: r.status, buf }), 'raw');
    if (++rawTick % 10 === 0) notify();
  } catch {} // body not available (e.g. streamed media); skipped
}

// ---------- Rendered snapshot of each visited page ----------
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

async function startRecording(tabId, files, full) {
  await clearAll();
  await setState({ on: true, tabs: [tabId], seq: 0, started: Date.now(), files, full });
  badge();
  // Full copy: attach, then reload so the page's code is captured from its very first request.
  if (full && await attach(tabId)) await chrome.tabs.reload(tabId, { bypassCache: true });
  else captureTab(tabId, true);
}

async function stopRecording() {
  const s = await getState(); await setState({ ...s, on: false, tabs: [] }); badge();
  for (const t of s.tabs) await detach(t);
  await Promise.all([...inFlight].map(() => new Promise(r => setTimeout(r, 1500)))); // let a running capture finish
  const c = await counts(); if (!c.count && !c.raw) return { count: 0 };
  // Build the zip in an offscreen document: it can hold a Blob and hand Chrome a blob: URL (a service worker can't).
  if (!(await chrome.offscreen.hasDocument?.())) await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['BLOBS'], justification: 'Armar el .zip de la grabación' });
  const r = await chrome.runtime.sendMessage({ type: 'buildZip', state: s });
  if (!r || r.error) return { error: r?.error || 'no se pudo armar el zip' };
  const id = await chrome.downloads.download({ url: r.url, filename: `${r.folder}.zip`, saveAs: true, conflictAction: 'uniquify' });
  await chrome.storage.local.set({ zipDownload: id });
  return { count: r.count, raw: r.raw, folder: r.folder + '.zip' };
}
// When the zip download ends, free the offscreen document (it owns the blob) and the stored data.
chrome.downloads.onChanged.addListener(async d => {
  const { zipDownload } = await chrome.storage.local.get('zipDownload');
  if (d.id !== zipDownload || !d.state || d.state.current === 'in_progress') return;
  await chrome.storage.local.remove('zipDownload');
  try { await chrome.offscreen.closeDocument(); } catch {}
  if (d.state.current === 'complete' && !(await getState()).on) await clearAll();
});

// Follow navigations in recorded tabs (full loads + SPA route changes).
chrome.webNavigation.onCompleted.addListener(async d => {
  if (d.frameId !== 0) return; const s = await getState();
  if (s.on && s.tabs.includes(d.tabId)) captureTab(d.tabId, true);
});
chrome.webNavigation.onHistoryStateUpdated.addListener(async d => {
  if (d.frameId !== 0) return; const s = await getState();
  if (s.on && s.tabs.includes(d.tabId)) captureTab(d.tabId, true, true);
});
// Every tab opened while recording (from a link, Ctrl+T, another window…) is recorded too.
let tabLock = Promise.resolve();
const addTab = id => (tabLock = tabLock.then(async () => {
  const s = await getState();
  if (!s.on || s.tabs.includes(id)) return;
  s.tabs.push(id); await setState(s); if (s.full) await attach(id); notify();
}));
chrome.tabs.onCreated.addListener(t => addTab(t.id));
chrome.webNavigation.onCreatedNavigationTarget.addListener(d => addTab(d.tabId));
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
      const seq = prev ? prev.seq : Date.now(); // capture time = page order
      await tx('readwrite', st => st.put({ url: msg.url, title: msg.title, name: msg.name, html: msg.html, seq }));
      notify();
      return { ok: true };
    })());
  }
  if (msg.type === 'recStart') return done(startRecording(msg.tabId, msg.files, msg.full));
  if (msg.type === 'recStop') return done(stopRecording());
  if (msg.type === 'recStatus') return done((async () => ({ ...(await getState()), ...(await counts()) }))());
});
chrome.runtime.onStartup.addListener(badge);
