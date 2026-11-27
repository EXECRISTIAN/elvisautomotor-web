# Guardar Offline (extensión de Chrome)

Copia sitios web completos para verlos sin internet o reutilizarlos.

## Instalar
1. Abrí `chrome://extensions` y activá **Modo de desarrollador**.
2. **Cargar descomprimida** → elegí esta carpeta (`tools/offline-saver`).
3. Al actualizar: reemplazá la carpeta y tocá ↻ en la extensión.

## Grabar todo (modo principal)
1. Abrí la página donde querés empezar y tocá **● Iniciar grabación**.
2. Navegá normalmente. Se graba **esta pestaña y todas las pestañas que abras después** (desde links, Ctrl+T, otra ventana), con cada página que visites. El ícono muestra cuántas páginas lleva.
3. Tocá **■ Stop y descargar** → se descarga `Copia-<fecha>.zip`.

Con **Copia completa del código original** (activada por defecto) la extensión usa el protocolo de DevTools para guardar **cada archivo que el servidor envía** al navegador. Al iniciar recarga la página para capturarla desde el primer pedido, y Chrome muestra la barra “Guardar Offline está depurando este navegador”: es normal, no la cierres hasta terminar.

### Qué trae el zip
```
Copia-<fecha>/
  index.html               resumen + lista de páginas
  LEEME.txt
  lista-de-archivos.csv    URL original → archivo, tipo, tamaño
  paginas/                 cada página como se veía, lista para abrir sin internet
    001-Inicio.html …
    assets/css|img|fonts|media/
  codigo-original/         TODO lo que envió el servidor, sin modificar
    www.sitio.com/
      index.html
      assets/app-123.js
      api/autos.json
      fonts/… img/… videos/…
```
- `paginas/`: copias fijas (sin JavaScript), con links entre páginas apuntando a las copias locales. Cada CSS es un archivo propio y las imágenes se toman del código (`data-src`, `srcset` en la mayor resolución).
- `codigo-original/`: HTML, JavaScript, CSS, JSON de APIs, imágenes, fuentes, videos, PDF, wasm… byte por byte, en la estructura de carpetas de cada dominio. Usan rutas absolutas del sitio (`/assets/app.js`), así que para que funcionen como sitio hay que servir la carpeta del dominio en la raíz de un servidor web.

Cada página y cada archivo se guarda una sola vez (se ignoran parámetros de seguimiento como `_gl`, `utm_*`, `gclid`). En sitios que cambian de página sin recargar, se espera a que aparezca el contenido nuevo.

## Solo esta página
**Guardar esta página** descarga un único `.html` con todo embebido (base64).

## Limitaciones
- Solo se copia lo que se carga mientras navegás: secciones que nunca abriste no se incluyen.
- Videos por streaming (HLS/DASH) pueden quedar incompletos.
- Iframes de otros dominios, publicidad y seguimiento no se copian en `paginas/`.
- El contenido de terceros tiene derechos de autor: usá las copias con sitios propios o con permiso.
