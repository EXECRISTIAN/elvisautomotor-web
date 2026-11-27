const $ = id => document.getElementById(id);
const send = m => chrome.runtime.sendMessage(m);
chrome.runtime.onMessage.addListener(m => { if (m.type === 'progress') $('s').textContent = m.text; if (m.type === 'recUpdate') refresh(); });

$('go').onclick = async () => {
  $('go').disabled = true; $('s').textContent = 'Iniciando…';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: o => { window.__offlineOpts = o; }, args: [{ noJs: $('noJs').checked, scroll: $('scroll').checked, record: false }] });
    const [{ result: r }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['capture.js'] });
    $('s').textContent = r && r.ok ? `Listo: ${r.name}\n${r.count} recursos embebidos, ${(r.size / 1048576).toFixed(1)} MB` : 'Error: ' + (r && r.error);
  } catch (e) { $('s').textContent = 'Error: ' + e.message; }
  $('go').disabled = false;
};

let on = false;
async function refresh() {
  const st = await send({ type: 'recStatus' }); on = st.on;
  $('rec').textContent = on ? '■ Stop y descargar' : '● Iniciar grabación';
  $('rec').classList.toggle('on', on);
  $('rs').textContent = on ? `Grabando… ${st.count} página(s) capturada(s)` : '';
}
$('rec').onclick = async () => {
  $('rec').disabled = true;
  if (!on) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await send({ type: 'recStart', tabId: tab.id });
  } else {
    $('rs').textContent = 'Generando archivos…';
    const r = await send({ type: 'recStop' });
    $('rec').disabled = false; await refresh();
    $('rs').textContent = r.error ? 'Error: ' + r.error : r.count ? `${r.count} páginas en ${r.folder}\nDescomprimilo y abrí index.html` : 'No se capturó ninguna página.';
    return;
  }
  $('rec').disabled = false; refresh();
};
refresh();
