#!/bin/bash
# Guarda el HTML original (sin convertir) de cada página en sitio/_raw/ para el iniciador local.
set -e
SITE=/var/tmp/offline3/sitio; RAW=$SITE/_raw; rm -rf $RAW; mkdir -p $RAW/inventory
save() { curl -sS -m 30 "http://localhost:3000$1" -o "$RAW/$2"; }
save / index.html
for r in panel inventory ofertas financing precalificador trade-in nosotros contact test-drive; do save /$r $r.html; done
save '/inventory?condition=new' 'inventory@condition=new.html'
save '/inventory?condition=used' 'inventory@condition=used.html'
for id in $(psql "postgresql://postgres:pg@localhost:5433/elvis_demo" -Atc "select id from \"Vehicle\""); do save /inventory/$id inventory/$id.html; done
# Imágenes originales para /_next/image?url=/images/...
mkdir -p $SITE/images && cp -r /home/user/elvisautomotor-web/public/images/. $SITE/images/
cp /home/user/elvisautomotor-web/public/favicon* $SITE/ 2>/dev/null || true
# Copia del inventario para la muestra local (filtros, fichas, financiación, comparar).
mkdir -p $SITE/_offline
curl -sS -m 30 http://localhost:3000/api/graphql -H 'content-type: application/json' -d '{"query":"{ publicInventoryVehicles(take: 100, orderBy: [{ year: desc }]) { items { id vin stockNumber year make model trim color: exteriorColor fuelType transmission engine isFeatured progressiveOffer mileage price previousPrice usedReport status condition features description images { id imagePath image { url } isPrimary sortOrder } } } }"}' \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); json.dump({"vehicles": d["data"]["publicInventoryVehicles"]["items"]}, open(sys.argv[1],"w"), ensure_ascii=False)' $SITE/_offline/datos.json
# Marca la muestra local: los formularios y el panel guardan en el navegador (sin servidor).
TPL=$(ls $RAW/inventory | head -1 | sed 's/\.html$//')
for f in $(find $RAW -name '*.html'); do sed -i "s#<head>#<head><script>window.__ELVIS_OFFLINE__=true;window.__ELVIS_TEMPLATE__='$TPL'</script>#" "$f"; done
echo "html original: $(find $RAW -name '*.html' | wc -l) páginas"
