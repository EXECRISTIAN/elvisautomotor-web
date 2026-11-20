# Elvis Automotores en tu PC

Hay dos formas de verlo en tu computadora, sin internet.

## 1. Versión completa (recomendada): todo funciona y se guarda en tu PC

Sitio + panel de administración + base de datos. Las consultas, solicitudes de crédito,
usados ofrecidos, usuarios, autos, ofertas y bancos que cargues **quedan guardados en tu PC**.

1. Instala **Docker Desktop** (una sola vez): https://www.docker.com/products/docker-desktop/
   y ábrelo hasta que diga *Engine running*.
2. Descarga el proyecto (rama `claude/gifted-thompson-hp4ggn`) y descomprímelo.
3. Doble clic en **`INICIAR-ELVIS.bat`**. La primera vez tarda varios minutos.
   Se abren solos el sitio (http://localhost:3000) y el panel (http://localhost:3000/dashboard).
4. Panel: usuario **`123`**, contraseña **`123`** (administrador).
   Desde **Administración → Personal** creas vendedores y otros usuarios con su rol.
5. Para apagar: **`DETENER-ELVIS.bat`**. Los datos quedan guardados para la próxima vez.

Empezar de cero (borra todo lo cargado): en una terminal dentro de la carpeta,
`docker compose down -v` y luego `INICIAR-ELVIS.bat`.

**Importante:** la contraseña `123` es solo para uso local. Antes de publicar el sitio en
internet hay que cambiarla por una segura.

Limitación: subir fotos nuevas (de autos o de usados) necesita un almacenamiento de fotos
que se configura al publicar; en la PC el resto funciona.

## 2. Muestra rápida (sin instalar nada): para mirar, no guarda datos

Descomprime `elvis-muestra-offline.zip` y haz doble clic en **`INICIAR-MUESTRA.bat`**.
Menús, filtros, simulador de cuotas y botones funcionan; los formularios no se envían y no
hay panel (no hay base de datos). `ABRIR-AQUI.html` sirve solo para mirar: abierto como
archivo, el navegador no ejecuta los menús.
