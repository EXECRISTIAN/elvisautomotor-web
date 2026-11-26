const $ = s => document.querySelector(s);
const get = k => chrome.storage.local.get(k);
const set = o => chrome.storage.local.set(o);
const estado = t => ($('#estado').textContent = t);

document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button,section').forEach(e => e.classList.remove('on'));
  b.classList.add('on'); $('#' + b.dataset.t).classList.add('on');
});

async function cargar() {
  const { perfiles = {}, perfilActivo } = await get(['perfiles','perfilActivo']);
  const perfil = perfiles[perfilActivo] || {};
  document.querySelectorAll('.selPerfil').forEach(s => {
    s.innerHTML = '';
    Object.keys(perfiles).forEach(n => s.add(new Option(n, n, false, n === perfilActivo)));
  });
  const { urls = [], indice = 0, hechos = [], auto = false } = await get(['perfil','urls','indice','hechos','auto']);
  document.querySelectorAll('[data-k]').forEach(i => i.value = perfil[i.dataset.k] || '');
  $('#urls').value = urls.join('\n');
  $('#auto').checked = auto;
  $('#resumen').textContent = urls.length
    ? `Completadas ${hechos.length} de ${urls.length}`
    : 'Agrega direcciones en la pestaña "Direcciones".';
  $('#items').innerHTML = '';
  urls.forEach((u, i) => {
    const li = document.createElement('li');
    li.textContent = u;
    if (hechos.includes(i)) li.className = 'done';
    else if (i === indice) li.className = 'cur';
    li.style.cursor = 'pointer';
    li.title = 'Ir a esta dirección';
    li.onclick = () => irA(i);
    $('#items').appendChild(li);
  });
}

async function tabActual() { return (await chrome.tabs.query({ active: true, currentWindow: true }))[0]; }

async function irA(i) {
  const { urls = [] } = await get('urls');
  if (i >= urls.length) { estado('🎉 ¡Terminaste toda la lista!'); await set({ indice: urls.length }); return cargar(); }
  await set({ indice: i, pendienteAuto: true });
  const tab = await tabActual();
  await chrome.tabs.update(tab.id, { url: urls[i] });
  cargar();
}

const leerForm = () => { const o = {}; document.querySelectorAll('[data-k]').forEach(i => o[i.dataset.k] = i.value.trim()); return o; };
async function perfiles() { return (await get('perfiles')).perfiles || {}; }
async function activo() { return (await get('perfilActivo')).perfilActivo; }

document.querySelectorAll('.selPerfil').forEach(s => s.onchange = async () => { await set({ perfilActivo: s.value }); cargar(); estado('Usando: ' + s.value); });

$('#guardarDatos').onclick = async () => {
  const ps = await perfiles(), a = await activo() || 'Principal';
  ps[a] = leerForm(); await set({ perfiles: ps, perfilActivo: a }); estado(`Perfil "${a}" guardado ✔`); cargar();
};
$('#nuevoPerfil').onclick = async () => {
  const n = prompt('Nombre del nuevo perfil:'); if (!n) return;
  const ps = await perfiles(); if (ps[n]) return alert('Ya existe');
  ps[n] = {}; await set({ perfiles: ps, perfilActivo: n }); cargar();
};
$('#duplicarPerfil').onclick = async () => {
  const ps = await perfiles(), a = await activo(); const n = prompt('Nombre de la copia:', a + ' (copia)'); if (!n || ps[n]) return;
  ps[n] = { ...leerForm() }; await set({ perfiles: ps, perfilActivo: n }); cargar();
};
$('#renombrarPerfil').onclick = async () => {
  const ps = await perfiles(), a = await activo(); const n = prompt('Nuevo nombre:', a); if (!n || n === a || ps[n]) return;
  ps[n] = ps[a]; delete ps[a]; await set({ perfiles: ps, perfilActivo: n }); cargar();
};
$('#borrarPerfil').onclick = async () => {
  const ps = await perfiles(), a = await activo();
  if (Object.keys(ps).length < 2) return alert('Debe quedar al menos un perfil');
  if (!confirm(`¿Borrar el perfil "${a}"?`)) return;
  delete ps[a]; await set({ perfiles: ps, perfilActivo: Object.keys(ps)[0] }); cargar();
};
$('#exportar').onclick = async () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(await perfiles(), null, 2)], { type: 'application/json' }));
  chrome.downloads ? chrome.downloads.download({ url, filename: 'perfiles.json' }) : Object.assign(document.createElement('a'), { href: url, download: 'perfiles.json' }).click();
};
$('#importar').onclick = () => $('#archivo').click();
$('#archivo').onchange = async e => {
  try {
    const nuevos = JSON.parse(await e.target.files[0].text());
    const ps = { ...(await perfiles()), ...nuevos };
    await set({ perfiles: ps, perfilActivo: (await activo()) || Object.keys(ps)[0] });
    estado(`Importados ${Object.keys(nuevos).length} perfiles ✔`); cargar();
  } catch { estado('Archivo no válido'); }
};
$('#guardarLista').onclick = async () => {
  const urls = $('#urls').value.split('\n').map(s => s.trim()).filter(Boolean)
    .map(u => /^https?:\/\//i.test(u) ? u : 'https://' + u);
  await set({ urls, indice: 0, hechos: [] }); estado(`Lista guardada (${urls.length})`); cargar();
};
$('#auto').onchange = e => set({ auto: e.target.checked });

$('#rellenar').onclick = async () => {
  const tab = await tabActual();
  const r = await chrome.runtime.sendMessage({ tipo: 'rellenar', tabId: tab.id });
  estado(r?.ok ? `Rellenados ${r.n} campos. Revisa y envía el formulario.` : 'No se pudo rellenar esta página.');
};
$('#siguiente').onclick = async () => {
  const { indice = 0, hechos = [] } = await get(['indice','hechos']);
  if (!hechos.includes(indice)) hechos.push(indice);
  await set({ hechos }); irA(indice + 1);
};
$('#saltar').onclick = async () => { const { indice = 0 } = await get('indice'); irA(indice + 1); };
$('#empezar').onclick = async () => { await set({ hechos: [] }); irA(0); };

cargar();
