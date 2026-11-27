# Guardar Offline (extensión de Chrome)

Guarda la página actual como **un solo archivo `.html`** que funciona sin internet: imágenes, CSS, fuentes, íconos, fondos, video/audio, iframes del mismo origen, canvas y valores de formularios quedan embebidos (base64).

## Instalar
1. Abrí `chrome://extensions` y activá **Modo de desarrollador**.
2. **Cargar descomprimida** → elegí esta carpeta (`tools/offline-saver`).

## Usar
Clic en el ícono → **Guardar página**. Opciones:
- *Quitar scripts*: deja una “foto” estática y liviana (recomendado). Si se desactiva, los JS también se embeben.

Limitaciones: iframes de otros dominios y videos por streaming (HLS/DASH) no se pueden embeber; datos que cargan por API después de abrir la página quedan como estaban en el momento de guardar.

## Modo grabación
En el popup, **● Iniciar grabación**: se guarda la página actual y, automáticamente, cada página a la que navegues desde esa pestaña (clicks, links que abren pestañas nuevas y cambios de ruta en apps tipo SPA). El ícono muestra cuántas páginas lleva.
**■ Stop y descargar** descarga **un solo `Grabacion-<fecha>.zip`** con un HTML por página + `index.html`. Descomprimilo y abrí `index.html`. Los links entre páginas grabadas apuntan a las copias locales, así se puede navegar offline.


### Formato para reutilizar en otra web
Con la opción **“CSS, imágenes y fuentes como archivos separados”** (activada por defecto) el zip queda así:
```
Grabacion-<fecha>/
  index.html
  001-Inicio.html
  002-Contacto.html
  assets/css/…   assets/img/…   assets/fonts/…   assets/media/…
```
Los HTML referencian `assets/…` con rutas relativas, así que la carpeta se puede subir tal cual a otro hosting, o copiar imágenes/secciones a otro proyecto. Cada hoja de estilos (externa, `<style>` o generada por JS) queda como archivo `.css` propio, compartido entre páginas; sus `url()` apuntan a `../img/…`. Los scripts se quitan.

Todo sale del código de la página en una sola pasada: las imágenes se toman de `data-src`/`srcset` (mayor resolución) sin hacer scroll, cada página se captura una vez y cada recurso se descarga una vez aunque aparezca en varias páginas.
Sin esa opción, todo queda embebido en base64 dentro de cada HTML (un archivo autocontenido por página).
