const $ = s => document.querySelector(s);
const get = k => chrome.storage.local.get(k);
const set = o => chrome.storage.local.set(o);
const estado = t => ($('#estado').textContent = t);

document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button,section').forEach(e => e.classList.remove('on'));
  b.classList.add('on'); $('#' + b.dataset.t).classList.add('on');
});

async function cargar() {
  const { perfil = {}, urls = [], indice = 0, hechos = [], auto = false } = await get(['perfil','urls','indice','hechos','auto']);
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

$('#guardarDatos').onclick = async () => {
  const perfil = {};
  document.querySelectorAll('[data-k]').forEach(i => perfil[i.dataset.k] = i.value.trim());
  await set({ perfil }); estado('Datos guardados ✔');
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
