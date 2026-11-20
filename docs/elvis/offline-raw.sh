#!/bin/bash
# Guarda el HTML original (sin convertir) de cada página en sitio/_raw/ para el iniciador local.
set -e
SITE=/var/tmp/offline3/sitio; RAW=$SITE/_raw; rm -rf $RAW; mkdir -p $RAW/inventory
save() { curl -sS -m 30 "http://localhost:3000$1" -o "$RAW/$2"; }
save / index.html
for r in inventory ofertas financing precalificador trade-in nosotros contact test-drive; do save /$r $r.html; done
save '/inventory?condition=new' 'inventory@condition=new.html'
save '/inventory?condition=used' 'inventory@condition=used.html'
for id in $(psql "postgresql://postgres:pg@localhost:5433/elvis_demo" -Atc "select id from \"Vehicle\""); do save /inventory/$id inventory/$id.html; done
# Imágenes originales para /_next/image?url=/images/...
mkdir -p $SITE/images && cp -r /home/user/elvisautomotor-web/public/images/. $SITE/images/
cp /home/user/elvisautomotor-web/public/favicon* $SITE/ 2>/dev/null || true
echo "html original: $(find $RAW -name '*.html' | wc -l) páginas"
