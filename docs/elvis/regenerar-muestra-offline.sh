#!/bin/bash
# Regenera docs/elvis/elvis-muestra-offline.zip desde el servidor en :3000 (base elvis_demo)
set -e
rm -rf /var/tmp/offline3 && mkdir -p /var/tmp/offline3 && cd /var/tmp/offline3
VIDS=$(psql "postgresql://postgres:pg@localhost:5433/elvis_demo" -Atc "select 'http://localhost:3000/inventory/'||id from \"Vehicle\"" | tr '\n' ' ')
wget -q -e robots=off --mirror --convert-links --adjust-extension --page-requisites --no-parent --restrict-file-names=windows -X /dashboard,/api,/account,/compare --reject-regex '(_rsc=|\?(sort|page)=)' http://localhost:3000/ http://localhost:3000/inventory http://localhost:3000/ofertas http://localhost:3000/financing http://localhost:3000/trade-in http://localhost:3000/nosotros http://localhost:3000/contact http://localhost:3000/test-drive $VIDS || true
mv "localhost+3000" sitio
python3 /home/user/elvisautomotor-web/docs/elvis/offline-fix-imagenes.py /var/tmp/offline3/sitio /home/user/elvisautomotor-web/public
cp /var/tmp/offline2/ABRIR-AQUI.html .
cat > LEEME.txt <<'EOF'
ELVIS AUTOMOTORES — MUESTRA OFFLINE

Cómo verla:
1. Descomprime esta carpeta (si ya tenías una versión anterior, reemplázala completa).
2. Haz doble clic en "ABRIR-AQUI.html" (se abre en el navegador, no necesita internet).

Es una copia fija del sitio con los datos de ejemplo. Se puede navegar entre páginas;
los formularios, la cuenta regresiva en vivo y el panel necesitan el sitio corriendo
(ver docs/elvis/PC-LOCAL.md).
EOF
rm -f /home/user/elvisautomotor-web/docs/elvis/elvis-muestra-offline.zip
zip -qr /home/user/elvisautomotor-web/docs/elvis/elvis-muestra-offline.zip ABRIR-AQUI.html LEEME.txt sitio
ls -la /home/user/elvisautomotor-web/docs/elvis/elvis-muestra-offline.zip
# Copia descomprimida en el repositorio (se ve y se descarga desde GitHub)
rm -rf /home/user/elvisautomotor-web/docs/elvis/muestra-offline
mkdir -p /home/user/elvisautomotor-web/docs/elvis/muestra-offline
cp -r /var/tmp/offline3/. /home/user/elvisautomotor-web/docs/elvis/muestra-offline/
