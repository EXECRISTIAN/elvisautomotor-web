# Guardar Offline (extensión de Chrome)

Guarda la página actual como **un solo archivo `.html`** que funciona sin internet: imágenes, CSS, fuentes, íconos, fondos, video/audio, iframes del mismo origen, canvas y valores de formularios quedan embebidos (base64).

## Instalar
1. Abrí `chrome://extensions` y activá **Modo de desarrollador**.
2. **Cargar descomprimida** → elegí esta carpeta (`tools/offline-saver`).

## Usar
Clic en el ícono → **Guardar página**. Opciones:
- *Quitar scripts*: deja una “foto” estática y liviana (recomendado). Si se desactiva, los JS también se embeben.
- *Scroll*: recorre la página para forzar la carga de imágenes diferidas (lazy).

Limitaciones: iframes de otros dominios y videos por streaming (HLS/DASH) no se pueden embeber; datos que cargan por API después de abrir la página quedan como estaban en el momento de guardar.
