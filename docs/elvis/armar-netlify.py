# Arma una copia de la muestra lista para subir a Netlify Drop (sitio estático con dirección gratis).
# Uso: python3 armar-netlify.py <carpeta "sitio" de la muestra> <zip de salida>
import os, shutil, sys, tempfile, urllib.parse, zipfile

src, out = sys.argv[1], sys.argv[2]
tmp = tempfile.mkdtemp()
dst = os.path.join(tmp, 'web')
shutil.copytree(src, dst, ignore=shutil.ignore_patterns('_raw'))
raw = os.path.join(src, '_raw')
rules = ['/_next/image  url=:url  :url  200']
variants = {}
for base, _, files in os.walk(raw):
    for f in files:
        rel = os.path.relpath(os.path.join(base, f), raw).replace(os.sep, '/')
        if '@' in rel:
            page, query = rel[:-5].split('@', 1)
            name = 'q/' + rel.replace('@', '_').replace('&', '_').replace('=', '-')
            os.makedirs(os.path.dirname(os.path.join(dst, name)), exist_ok=True)
            shutil.copy(os.path.join(base, f), os.path.join(dst, name))
            params = '  '.join(f'{k}={urllib.parse.quote(v)}' for k, v in urllib.parse.parse_qsl(query))
            variants.setdefault(page, []).append(f'/{page}  {params}  /{name}  200!')
        else:
            os.makedirs(os.path.dirname(os.path.join(dst, rel)), exist_ok=True)
            shutil.copy(os.path.join(base, f), os.path.join(dst, rel))
for page in sorted(variants, key=len, reverse=True):
    rules += sorted(variants[page], key=lambda r: -r.count('='))
cars = sorted(x for x in os.listdir(os.path.join(raw, 'inventory')) if x.endswith('.html'))
rules += ['/inventory  /inventory.html  200!', '/dashboard/*  /panel.html  200', '/account/*  /panel.html  200', '/account  /panel.html  200', '/signin  /panel.html  200']
if cars: rules.append(f'/inventory/*  /inventory/{cars[0]}  200')
open(os.path.join(dst, '_redirects'), 'w').write('\n'.join(rules) + '\n')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for base, _, files in os.walk(dst):
        for f in files:
            p = os.path.join(base, f); z.write(p, os.path.relpath(p, dst))
print('ok', out, len(rules), 'reglas')
