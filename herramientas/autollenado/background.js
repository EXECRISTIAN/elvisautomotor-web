importScripts('rellenar.js');

async function rellenarTab(tabId) {
  const { perfil = {} } = await chrome.storage.local.get('perfil');
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
