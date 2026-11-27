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

## Modo grabación
En el popup, **● Iniciar grabación**: se guarda la página actual y, automáticamente, cada página a la que navegues desde esa pestaña (clicks, links que abren pestañas nuevas y cambios de ruta en apps tipo SPA). El ícono muestra cuántas páginas lleva.
**■ Stop y descargar** descarga **un solo `Grabacion-<fecha>.zip`** con un HTML por página + `index.html`. Descomprimilo y abrí `index.html`. Los links entre páginas grabadas apuntan a las copias locales, así se puede navegar offline.


### Formato para reutilizar en otra web
Con la opción **“Imágenes y fuentes como archivos separados”** (activada por defecto) el zip queda así:
```
Grabacion-<fecha>/
  index.html
  001-Inicio.html
  002-Contacto.html
  assets/img/…   assets/fonts/…   assets/media/…
```
Los HTML referencian `assets/…` con rutas relativas, así que la carpeta se puede subir tal cual a otro hosting, o copiar imágenes/secciones a otro proyecto. El CSS queda en bloques `<style>` dentro de cada HTML y los scripts se quitan.
Sin esa opción, todo queda embebido en base64 dentro de cada HTML (un archivo autocontenido por página).
