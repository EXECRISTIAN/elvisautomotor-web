// Se inyecta en la página: detecta cada campo y le pone el dato que corresponde.
function rellenarFormulario(p) {
  const nombreCompleto = [p.nombre, p.apellido].filter(Boolean).join(' ');
  const [anio, mes, dia] = (p.nacimiento || '').split('-');
  const reglas = [
    [/pass(word)?|contrase|clave/, p.password, 'password'],
    [/e-?mail|correo/, p.email],
    [/user(name)?|usuario|login|nick/, p.usuario || (p.email || '').split('@')[0]],
    [/first.?name|given|^nombres?$|fname|primer.?nombre|\bnombre\b(?!.*(apell|complet|usuario))/, p.nombre],
    [/last.?name|surname|family|apellid|lname/, p.apellido],
    [/full.?name|nombre.?complet|^name$|your.?name/, nombreCompleto],
    [/country.?code|dial|c[oó]d.*pa[ií]s|prefij/, p.codigoPais],
    [/phone|tel|m[oó]vil|celular|mobile|whatsapp/, p.telefono],
    [/birth.?day|bday.?day|^dia$|^day$/, dia],
    [/birth.?month|^mes$|^month$/, mes],
    [/birth.?year|^a[nñ]o$|^year$/, anio],
    [/birth|nacim|dob/, p.nacimiento],
    [/gender|sex|g[eé]nero/, p.genero],
    [/country|pa[ií]s|nacionalidad/, p.pais],
    [/state|province|provincia|region|estado/, p.provincia],
    [/city|ciudad|localidad|town/, p.ciudad],
    [/zip|postal|c[oó]digo.?postal|\bcp\b/, p.cp],
    [/address|direcci[oó]n|street|calle|domicilio/, p.direccion],
    [/dni|document|cedula|c[eé]dula|rut|cuit|passport/, p.documento],
    [/company|empresa|organi[sz]ation|compa[nñ]/, p.empresa],
  ];
  const textoDe = el => {
    let t = [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), el.getAttribute('autocomplete')];
    if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) t.push(l.textContent); }
    const lp = el.closest('label'); if (lp) t.push(lp.textContent);
    return t.filter(Boolean).join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  };
  const poner = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : el.tagName === 'SELECT' ? HTMLSelectElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v); // compatible con React/Vue
    ['input', 'change', 'blur'].forEach(e => el.dispatchEvent(new Event(e, { bubbles: true })));
  };
  let n = 0;
  document.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.disabled || el.readOnly || el.offsetParent === null) return;
    const tipo = (el.type || '').toLowerCase();
    if (['hidden','submit','button','checkbox','radio','file','image','reset'].includes(tipo)) return;
    if (el.value && el.tagName !== 'SELECT') return; // no pisar lo ya escrito
    const t = textoDe(el);
    for (const [re, v, soloTipo] of reglas) {
      if (!v) continue;
      const coincide = soloTipo ? tipo === soloTipo
        : tipo !== 'password' && (re.test(t) || (tipo === 'email' && v === p.email));
      if (!coincide) continue;
      if (el.tagName === 'SELECT') {
        const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const op = [...el.options].find(o => norm(o.text) === norm(v) || o.value.toLowerCase() === v.toLowerCase())
                || [...el.options].find(o => norm(o.text).startsWith(norm(v)) || (v.length > 1 && norm(o.text).includes(norm(v))))
                || [...el.options].find(o => o.value.replace(/^0/, '') === String(v).replace(/^0/, ''));
        if (!op) continue;
        poner(el, op.value);
      } else poner(el, v);
      el.style.outline = '2px solid #10b981';
      n++; break;
    }
  });
  return n;
}
