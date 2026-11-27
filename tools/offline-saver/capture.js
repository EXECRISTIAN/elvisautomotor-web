(async () => {
  const opts = window.__offlineOpts || { noJs: true, scroll: true };
  const progress = t => chrome.runtime.sendMessage({ type: 'progress', text: t }).catch(() => {});
  const cache = new Map(); let count = 0;
  const abs = (u, base = location.href) => { try { return new URL(u, base).href; } catch { return null; } };
  const get = url => {
    if (!url || /^(data|blob|javascript|about):/i.test(url)) return Promise.resolve(null);
    if (!cache.has(url)) cache.set(url, chrome.runtime.sendMessage({ type: 'fetch', url }).then(r => {
      if (!r || r.error) return null; count++; if (count % 10 === 0) progress(`Descargando recursos… ${count}`); return r;
    }).catch(() => null));
    return cache.get(url);
  };
  const dataOf = async u => (await get(u))?.dataUrl || u;

  // Rewrite url(...) and @import inside CSS, recursively, relative to the stylesheet's own URL.
  async function inlineCss(css, base, depth = 0) {
    if (depth > 5) return css;
    const imports = [...css.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)['"]?\s*\)?([^;]*);/g)];
    for (const m of imports) {
      const u = abs(m[1], base), r = await get(u);
      const inner = r?.text ? await inlineCss(r.text, u, depth + 1) : '';
      css = css.replace(m[0], m[2].trim() ? `@media ${m[2].trim()}{${inner}}` : inner);
    }
    const urls = [...new Set([...css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map(m => m[2]))];
    const map = {}; await Promise.all(urls.map(async u => { if (!u.startsWith('data:') && !u.startsWith('#')) map[u] = await dataOf(abs(u, base)); }));
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (all, q, u) => map[u] ? `url("${map[u]}")` : all);
  }

  // 1. Trigger lazy loading.
  if (opts.scroll) {
    progress('Cargando imágenes diferidas…');
    const y = scrollY;
    for (let p = 0; p < document.body.scrollHeight; p += innerHeight) { scrollTo(0, p); await new Promise(r => setTimeout(r, 150)); }
    scrollTo(0, y);
    document.querySelectorAll('img[loading="lazy"]').forEach(i => i.loading = 'eager');
  }

  // 2. Freeze live state into the DOM before cloning.
  document.querySelectorAll('input').forEach(i => { if (/checkbox|radio/.test(i.type)) i.toggleAttribute('checked', i.checked); else i.setAttribute('value', i.value); });
  document.querySelectorAll('textarea').forEach(t => t.textContent = t.value);
  document.querySelectorAll('select option').forEach(o => o.toggleAttribute('selected', o.selected));
  const canvases = [...document.querySelectorAll('canvas')].map(c => { try { return c.toDataURL(); } catch { return null; } });

  const doc = document.documentElement.cloneNode(true);
  const $$ = s => [...doc.querySelectorAll(s)];
  $$('canvas').forEach((c, i) => { if (canvases[i]) { const img = document.createElement('img'); img.src = canvases[i]; img.style.cssText = c.style.cssText; img.width = c.width; img.height = c.height; img.className = c.className; c.replaceWith(img); } });

  progress('Procesando estilos…');
  // 3. Stylesheets: <link rel=stylesheet> → <style>. Also capture CSSOM-only rules (CSS-in-JS).
  const liveSheets = [...document.styleSheets];
  await Promise.all($$('link[rel~="stylesheet"][href]').map(async l => {
    const u = abs(l.getAttribute('href')), r = await get(u);
    if (!r?.text) return l.remove();
    const st = document.createElement('style'); if (l.media) st.media = l.media;
    st.textContent = await inlineCss(r.text, u); l.replaceWith(st);
  }));
  const styleEls = $$('style'), liveStyles = [...document.querySelectorAll('style')];
  await Promise.all(styleEls.map(async (st, i) => {
    let css = st.textContent;
    const live = liveStyles[i]?.sheet;
    if (!css.trim() && live) { try { css = [...live.cssRules].map(r => r.cssText).join('\n'); } catch {} }
    st.textContent = await inlineCss(css, location.href);
  }));
  try { for (const sh of document.adoptedStyleSheets || []) { const st = document.createElement('style'); st.textContent = await inlineCss([...sh.cssRules].map(r => r.cssText).join('\n'), location.href); doc.querySelector('head').appendChild(st); } } catch {}
  await Promise.all($$('[style]').map(async e => { const s = e.getAttribute('style'); if (s.includes('url(')) e.setAttribute('style', await inlineCss(s, location.href)); }));

  progress('Embebiendo imágenes y medios…');
  // 4. Images, media, icons, srcset.
  const liveImgs = [...document.images];
  await Promise.all($$('img').map(async (img, i) => {
    const src = liveImgs[i]?.currentSrc || img.getAttribute('src') || img.dataset.src;
    if (src) img.setAttribute('src', await dataOf(abs(src)));
    img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.removeAttribute('loading');
  }));
  $$('picture source').forEach(s => s.remove());
  await Promise.all($$('video[src],audio[src],source[src],track[src],embed[src],input[type=image][src]').map(async e => e.setAttribute('src', await dataOf(abs(e.getAttribute('src'))))));
  await Promise.all($$('video[poster]').map(async e => e.setAttribute('poster', await dataOf(abs(e.getAttribute('poster'))))));
  await Promise.all($$('link[rel~="icon"][href],link[rel="apple-touch-icon"][href]').map(async e => e.setAttribute('href', await dataOf(abs(e.getAttribute('href'))))));
  await Promise.all($$('image[href],image[*|href],use[href]').map(async e => { const h = e.getAttribute('href') || e.getAttribute('xlink:href'); if (h && !h.startsWith('#')) { const d = await dataOf(abs(h)); e.setAttribute('href', d); } }));
  await Promise.all($$('object[data]').map(async e => e.setAttribute('data', await dataOf(abs(e.getAttribute('data'))))));

  // 5. Same-origin iframes → srcdoc snapshot.
  const liveFrames = [...document.querySelectorAll('iframe')];
  $$('iframe').forEach((f, i) => { try { const d = liveFrames[i].contentDocument; if (d) { f.setAttribute('srcdoc', '<!doctype html>' + d.documentElement.outerHTML); f.removeAttribute('src'); } } catch {} });

  // 6. Scripts.
  if (opts.noJs) {
    $$('script:not([type="application/ld+json"])').forEach(s => s.remove());
    $$('link[rel=preload],link[rel=prefetch],link[rel=modulepreload],link[rel=preconnect],link[rel=dns-prefetch]').forEach(l => l.remove());
    $$('*').forEach(e => [...e.attributes].forEach(a => { if (/^on/i.test(a.name)) e.removeAttribute(a.name); }));
    $$('noscript').forEach(n => { const t = document.createElement('div'); t.innerHTML = n.textContent; n.replaceWith(...t.childNodes); });
  } else {
    await Promise.all($$('script[src]').map(async s => { const r = await get(abs(s.getAttribute('src'))); if (r?.text != null) { s.removeAttribute('src'); s.removeAttribute('integrity'); s.textContent = r.text.replace(/<\/script/gi, '<\\/script'); } }));
  }

  // 7. Absolute links, metadata, CSP removal.
  $$('a[href]').forEach(a => { const h = a.getAttribute('href'); if (!h.startsWith('#') && !/^(javascript|mailto|tel):/i.test(h)) a.setAttribute('href', abs(h) || h); });
  $$('form[action]').forEach(f => f.setAttribute('action', abs(f.getAttribute('action'))));
  $$('base, meta[http-equiv="Content-Security-Policy" i]').forEach(e => e.remove());
  $$('[integrity]').forEach(e => e.removeAttribute('integrity'));
  let meta = doc.querySelector('meta[charset]'); if (!meta) { meta = document.createElement('meta'); doc.querySelector('head').prepend(meta); } meta.setAttribute('charset', 'utf-8');
  doc.querySelector('head').prepend(document.createComment(` Guardado offline desde ${location.href} el ${new Date().toLocaleString()} `));

  progress('Generando archivo…');
  const dt = document.doctype ? `<!DOCTYPE ${document.doctype.name}>` : '<!DOCTYPE html>';
  const html = dt + '\n' + doc.outerHTML;
  const name = ((document.title || location.hostname).replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 100) || 'pagina') + '.html';
  const r = await chrome.runtime.sendMessage({ type: 'captured', html, name, title: document.title, url: location.href.split('#')[0], record: !!opts.record });
  if (r?.error) return { ok: false, error: r.error };
  return { ok: true, name, count, size: html.length };
})();
