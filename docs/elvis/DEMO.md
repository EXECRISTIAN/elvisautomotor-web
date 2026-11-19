# Publicar la demo de la propuesta en una URL temporal

Mientras Elvis Automotores no apruebe el proyecto, la web se muestra **solo en modo demostración**:

| Variable | Valor | Efecto |
|---|---|---|
| `DEMO_MODE` | `true` | Banner "Propuesta de sitio web — versión de demostración, no oficial", `noindex` (robots.txt, meta y cabecera `X-Robots-Tag`), formularios públicos y registro de clientes desactivados (no se guardan datos de personas). |
| `DEMO_PASSWORD` | una clave | El navegador pide usuario/contraseña (usuario: cualquiera). Recomendado: así nadie la encuentra ni la confunde con el sitio oficial. |

No apuntar el dominio `elvisautomotores.com` a esta demo. Usar el subdominio que da el proveedor (por ejemplo `xxxx.up.railway.app` o `xxxx.vercel.app`).

## Opción recomendada: Railway (el repo ya trae `railway.toml`)
1. Crear un proyecto en Railway → "Deploy from GitHub repo" → elegir este repositorio y la rama de trabajo.
2. Agregar un servicio **PostgreSQL** en el mismo proyecto.
3. Crear un bucket S3 compatible para las fotos (Cloudflare R2 tiene capa gratuita, o un bucket de Railway).
4. Variables del servicio web:
   - `DATABASE_URL` → la del Postgres de Railway
   - `SESSION_SECRET` → texto aleatorio de 32+ caracteres (por ejemplo `openssl rand -base64 48`)
   - `S3_BUCKET_NAME`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`
   - `DEMO_MODE=true`, `DEMO_PASSWORD=<clave>`, `HIDE_OPENFRONT_BRANDING=true` (opcional)
5. Deploy. Las migraciones se aplican solas (`release:migrate`).
6. Entrar a `/dashboard/init`, crear el usuario administrador y completar **Store Settings** con los datos del negocio
   (o ejecutar `docs/elvis/perfil-elvis.sql` sobre la base). Dejar el WhatsApp vacío hasta tener el número confirmado.
7. Cargar algunos autos reales con fotos (Inventory → Intake) para que la demo se vea completa.

## Antes de pasar a producción (si el cliente aprueba)
- `DEMO_MODE=false` y quitar `DEMO_PASSWORD`.
- Confirmar con Elvis: número de WhatsApp, textos institucionales y uso de su marca, logo y fotos.
- Apuntar el dominio `www.elvisautomotores.com`.
