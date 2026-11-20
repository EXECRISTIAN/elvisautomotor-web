# Reescribe las imágenes de Next (/_next/image?url=...) a archivos locales para que la muestra
# offline funcione abriendo los HTML directo desde la PC (file://). Uso: python3 offline-fix-imagenes.py <carpeta sitio> <carpeta public>
import os, re, shutil, sys, urllib.parse
site, public = sys.argv[1], sys.argv[2]
shutil.copytree(os.path.join(public, 'images'), os.path.join(site, 'images'), dirs_exist_ok=True)
pat = re.compile(r'(?:\.\./)*/?_next/image(?:\?|@)url=([^&"\s]+)(?:&amp;|&)w=\d+(?:&amp;|&)q=\d+(?:\.\w+)?')
total = 0
for root, _, files in os.walk(site):
    for f in files:
        if not f.endswith('.html'):
            continue
        p = os.path.join(root, f)
        depth = os.path.relpath(site, root)
        prefix = '' if depth == '.' else depth.replace(os.sep, '/') + '/'
        s = open(p, encoding='utf-8', errors='ignore').read()
        def rep(m):
            url = m.group(1)
            while '%' in url and urllib.parse.unquote(url) != url:
                url = urllib.parse.unquote(url)
            return prefix + url.lstrip('/') if url.startswith('/') else url
        # Sin srcset/sizes: el navegador usa directamente el archivo local de src.
        s = re.sub(r'\s(?:srcSet|srcset|imageSrcSet|imagesrcset|sizes|imageSizes|imagesizes)="[^"]*"', '', s)
        s2, n = pat.subn(rep, s)
        # rutas absolutas restantes a /images/... -> relativas
        s2 = re.sub(r'(["\s,(])/images/', lambda m: m.group(1) + prefix + 'images/', s2)
        if n or s2 != s:
            open(p, 'w', encoding='utf-8').write(s2)
            total += n
print('imágenes reescritas:', total)
