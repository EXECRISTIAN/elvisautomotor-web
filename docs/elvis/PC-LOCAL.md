# Correr Elvis Automotores completo en tu PC (sitio + panel + base de datos)

## Opción rápida: solo mirar (sin instalar nada)
Descomprime `docs/elvis/elvis-muestra-offline.zip` y abre `ABRIR-AQUI.html`.
Es una copia fija: se navega, pero los formularios y el panel no funcionan.

## Opción completa con Docker (Windows, Mac o Linux)
1. Instala **Docker Desktop** (docker.com) y ábrelo.
2. Descarga este repositorio (rama `claude/gifted-thompson-hp4ggn`) y abre una terminal en la carpeta.
3. Ejecuta:
   ```
   docker compose up --build
   ```
   La primera vez tarda varios minutos (descarga e instala todo). La base se crea sola con los
   datos de ejemplo de Elvis (14 vehículos, bancos Nación y Provincia, un plan de ejemplo y una oferta progresiva de ejemplo).
4. Abre http://localhost:3000 (sitio) y http://localhost:3000/dashboard (panel).
   - Usuario: `admin@elvis.local` — Contraseña: `ElvisDemo-2026` → **cámbiala** al entrar.
5. Para apagar: `Ctrl+C` o `docker compose down`. Los datos quedan guardados.
   Para empezar de cero: `docker compose down -v`.

## Qué funciona localmente
- Todo el sitio, formularios (quedan guardados en el panel), simulador de financiación, ofertas progresivas y panel.
- **No** funciona subir fotos nuevas (requiere un almacenamiento S3; se configura al publicar).
- Nada se envía por email ni por WhatsApp desde el sistema: las consultas se ven en el panel.
