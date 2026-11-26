importScripts('rellenar.js');

async function rellenarTab(tabId) {
  const { perfiles = {}, perfilActivo } = await chrome.storage.local.get(['perfiles', 'perfilActivo']);
  const perfil = perfiles[perfilActivo] || {};
  const res = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true }, func: rellenarFormulario, args: [perfil]
  });
  return { ok: true, n: res.reduce((a, r) => a + (r.result || 0), 0) };
}

chrome.runtime.onMessage.addListener((m, _s, responder) => {
  if (m.tipo === 'rellenar') { rellenarTab(m.tabId).then(responder).catch(() => responder({ ok: false })); return true; }
});

// Autollenado al terminar de cargar una dirección abierta desde la lista
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== 'complete') return;
  const { auto, pendienteAuto } = await chrome.storage.local.get(['auto', 'pendienteAuto']);
  if (!auto || !pendienteAuto) return;
  await chrome.storage.local.set({ pendienteAuto: false });
  setTimeout(() => rellenarTab(tabId).catch(() => {}), 1200); // dar tiempo a formularios dinámicos
});

// Al instalar: precargar perfiles desde perfiles.json (y migrar datos de la versión anterior)
chrome.runtime.onInstalled.addListener(async () => {
  const { perfiles = {}, perfil, perfilActivo } = await chrome.storage.local.get(['perfiles', 'perfil', 'perfilActivo']);
  if (perfil && Object.keys(perfil).length && !perfiles.Principal) perfiles.Principal = perfil;
  try {
    const pre = await (await fetch(chrome.runtime.getURL('perfiles.json'))).json();
    for (const [n, d] of Object.entries(pre)) if (!perfiles[n]) perfiles[n] = d;
  } catch {}
  if (!Object.keys(perfiles).length) perfiles.Principal = {};
  await chrome.storage.local.set({ perfiles, perfilActivo: perfiles[perfilActivo] ? perfilActivo : Object.keys(perfiles)[0] });
  await chrome.storage.local.remove('perfil');
});
