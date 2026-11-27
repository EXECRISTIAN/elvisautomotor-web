const s = document.getElementById('s'), go = document.getElementById('go');
chrome.runtime.onMessage.addListener(m => { if (m.type === 'progress') s.textContent = m.text; });
go.onclick = async () => {
  go.disabled = true; s.textContent = 'Iniciando…';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const opts = { noJs: noJs.checked, scroll: scroll.checked };
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: o => { window.__offlineOpts = o; }, args: [opts] });
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['capture.js'] });
    const r = await result;
    s.textContent = r && r.ok ? `Listo: ${r.name}\n${r.count} recursos embebidos, ${(r.size/1048576).toFixed(1)} MB` : 'Error: ' + (r && r.error);
  } catch (e) { s.textContent = 'Error: ' + e.message; }
  go.disabled = false;
};
