#!/bin/bash
# Regenera docs/elvis/elvis-muestra-offline.zip desde el servidor en :3000 (base elvis_demo)
set -e
rm -rf /var/tmp/offline3 && mkdir -p /var/tmp/offline3 && cd /var/tmp/offline3
VIDS=$(psql "postgresql://postgres:pg@localhost:5433/elvis_demo" -Atc "select 'http://localhost:3000/inventory/'||id from \"Vehicle\"" | tr '\n' ' ')
wget -q -e robots=off --mirror --convert-links --adjust-extension --page-requisites --no-parent --restrict-file-names=windows -X /dashboard,/api,/account --reject-regex '(_rsc=|\?(sort|page)=)' http://localhost:3000/ http://localhost:3000/inventory 'http://localhost:3000/inventory?condition=new' 'http://localhost:3000/inventory?condition=used' http://localhost:3000/ofertas http://localhost:3000/financing http://localhost:3000/precalificador http://localhost:3000/trade-in http://localhost:3000/nosotros http://localhost:3000/contact http://localhost:3000/test-drive http://localhost:3000/compare http://localhost:3000/photo-credits http://localhost:3000/service $VIDS || true
mv "localhost+3000" sitio
python3 /home/user/elvisautomotor-web/docs/elvis/offline-fix-imagenes.py /var/tmp/offline3/sitio /home/user/elvisautomotor-web/public
bash /home/user/elvisautomotor-web/docs/elvis/offline-raw.sh
cp /home/user/elvisautomotor-web/app/favicon.ico /home/user/elvisautomotor-web/app/icon.png /home/user/elvisautomotor-web/app/apple-icon.png sitio/

cp /home/user/elvisautomotor-web/docs/elvis/offline-iniciador/LEEME.txt /home/user/elvisautomotor-web/docs/elvis/offline-iniciador/INICIAR-MUESTRA.bat /home/user/elvisautomotor-web/docs/elvis/offline-iniciador/servidor.ps1 .
rm -f /home/user/elvisautomotor-web/docs/elvis/elvis-muestra-offline.zip
zip -qr /home/user/elvisautomotor-web/docs/elvis/elvis-muestra-offline.zip INICIAR-MUESTRA.bat servidor.ps1 LEEME.txt sitio
ls -la /home/user/elvisautomotor-web/docs/elvis/elvis-muestra-offline.zip
# Copia descomprimida en el repositorio (se ve y se descarga desde GitHub)
rm -rf /home/user/elvisautomotor-web/docs/elvis/muestra-offline
mkdir -p /home/user/elvisautomotor-web/docs/elvis/muestra-offline
cp -r /var/tmp/offline3/. /home/user/elvisautomotor-web/docs/elvis/muestra-offline/
