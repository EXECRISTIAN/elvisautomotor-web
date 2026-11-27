# Elvis Automotores — Fase 1: Auditoría de la plantilla base

Base: plantilla de código abierto con licencia **MIT** (permite uso comercial y modificación; se conserva el archivo `LICENSE` en el repositorio).
Referencia visual: `docs/elvis/referencia-diseno.webp`.

## 1. Arquitectura actual
| Capa | Tecnología |
|---|---|
| Frontend | Next.js (App Router) + React, Tailwind, Radix/shadcn (`components/`) |
| Storefront público | `app/(storefront)/*` → pantallas en `features/storefront/screens` |
| Panel admin | `app/dashboard` → `features/dashboard` (UI propia sobre Keystone, no el Admin UI por defecto) |
| Backend / API | Keystone 6 (GraphQL) — `keystone.ts`, `features/keystone` |
| Base de datos | PostgreSQL vía Prisma (`schema.prisma`, 53 migraciones en `migrations/`) |
| Archivos | S3 compatible (`S3_*`) para imágenes |
| Servicios externos | SMTP (emails), Stripe (pagos), OpenRouter (chat IA del panel), MCP |
| Deploy | Vercel / Railway (`railway.toml`) |

## 2. Funcionalidades existentes (se reutilizan, no se reconstruyen)
- **Inventario**: `Vehicle` (marca, modelo, versión/trim, año, km, precio, color, descripción, estado, `features`, `metadata` JSON), `VehicleImage` (múltiples fotos, principal, orden), `Make`/`Model`, historial de precios. Listado con filtros, detalle por vehículo, comparador.
- **Financiación**: `FinancingApplication` (solicitud con anticipo, plazo, tasa), `LenderSubmission`/`LenderDecision` (envío a entidades y decisión), página `/financing`. Ya existe el concepto de "proveedor" (`providerKey`) → punto de enganche para APIs bancarias futuras.
- **Toma de usados**: `TradeIn` + página `/trade-in` (una sola foto principal).
- **CRM**: `Lead`, `Customer`, `CustomerInteraction`, `Task`, reglas de asignación, `TestDrive`, `Deal`.
- **Auth y permisos**: `@keystone-6/auth`, sesiones firmadas (`SESSION_SECRET` ≥ 32 chars), contraseñas con hash, roles con permisos granulares (`canManageLeads`, `canManageFinancing`, …), multi‑sucursal (`Rooftop`), API keys con scopes, throttling de login.
- **Configuración del negocio**: `DealershipProfile` (nombre, teléfono, dirección, horarios, moneda, logo).
- Además: servicio/taller, repuestos, contabilidad, pagos (fuera de alcance de Elvis; se ocultan del menú, no se borran).

## 3. Faltantes respecto del pedido
| Requisito | Estado | Propuesta |
|---|---|---|
| Combustible, transmisión, cilindrada | No hay campos | Agregar columnas a `Vehicle` (migración) + filtros |
| Destacados en home | No hay flag | Campo `isFeatured` |
| Bancos y productos financieros (TNA, TEA, CFT, plazos, montos, % financiable, vigencia, sistema de amortización, gastos) | **No existe** (`FinanceProduct` es para seguros/garantías F&I, no créditos) | Nuevos modelos `Bank` y `FinancingPlan`, administrables |
| Simulador de cuotas | No existe | Cálculo francés/alemán **en servidor**, con leyenda "estimativo, sujeto a aprobación bancaria"; sin planes cargados no se muestra simulación |
| Toma de usado con varias fotos | 1 foto | Modelo de fotos múltiples para `TradeIn` |
| WhatsApp | No existe | Número en `DealershipProfile` + botón con mensaje (vehículo, año, precio, link) |
| Español argentino / ARS | Todo en inglés, USD | Traducción de storefront y panel, `lang="es-AR"`, formato `$ 54.900.000` |
| Marca Elvis | Branding de la plantilla | Nuevo tema negro/dorado según referencia |

## 4. Problemas / riesgos detectados
- **Datos de ejemplo**: el seed trae vehículos/fotos de demo en `public/images/vehicles` — se deben reemplazar por stock real antes de publicar.
- **Contenido ficticio de la referencia visual**: las cifras "150+ vehículos", "5000+ clientes", "5 estrellas en Google", "7 días de garantía de cambio" y los autos/precios del mockup **no se publicarán** salvo que Elvis confirme que son reales; quedarán como textos editables.
- Funcionalidades no usadas (Stripe, IA/OpenRouter, MCP) amplían la superficie de ataque: se desactivan si no hay variables configuradas y se ocultan del menú.
- Requiere PostgreSQL y bucket S3 para correr; no hay `.env` en el repo (correcto, `.gitignore` ya excluye `.env*`).
- El logotipo AE original todavía no fue entregado como archivo (solo aparece dentro de la imagen de referencia).

## 5. Plan de implementación (por etapas, cada una verificada con `lint` + `build`)
1. **Identidad visual + Home** (Fases 2–3): tokens de color, tipografías, header/footer, hero, accesos, destacados, secciones financiación / tomamos tu usado / beneficios / contacto. Español.
2. **Inventario** (Fase 4): nuevos campos, filtros, detalle y botón WhatsApp (Fase 8).
3. **Panel administrativo** (Fase 7): traducción, menú simplificado, alta/edición de autos, destacados, configuración de WhatsApp.
4. **Financiación bancaria** (Fase 5): modelos Bank/FinancingPlan, simulador, solicitud, interfaz `BankProvider` para integraciones futuras.
5. **Tomamos tu usado** (Fase 6): fotos múltiples, bandeja en el panel.
6. **Calidad y seguridad** (Fase 9): SEO es-AR, validaciones, revisión de permisos, documentación de despliegue.

## Etapa 1 — Identidad visual y página principal (realizada)
- Logo AE recreado en vector: `public/brand/elvis-ae.svg` (también favicon).
- Tema negro / dorado metálico / blanco (`styles/tokens.css`, `styles/elvis.css`), tipografía Montserrat.
- Header, menú móvil y footer en español; página principal nueva (`screens/HomePage.tsx`).
- WhatsApp configurable: campo `whatsappNumber` en Configuración de la tienda (migración `20261119120000_elvis_whatsapp`). Si no está cargado, los botones no se muestran.
- Moneda por defecto ARS, formato es-AR y kilómetros.
- Next.js actualizado a 16.4.6 (la versión instalada tenía una vulnerabilidad conocida y bloqueaba el build).
- Capturas: `etapa1-escritorio.png`, `etapa1-celular.png`.

## Etapa 2 — Inventario y WhatsApp (realizada)
- Nuevos campos de vehículo: combustible, transmisión, cilindrada/motor y "destacado" (migración `20261119130000_elvis_vehicle_specs`).
  Opciones y validación compartidas en `features/lib/vehicleSpecs.ts` (validadas también en el servidor).
- Los campos se cargan en el alta y en la edición del panel (Inventory → vehículo → Edit). Como cambian el contenido publicado,
  la publicación vuelve a borrador y debe aprobarse de nuevo (mismo circuito de revisión).
- Botón "Destacar" en la ficha del panel (no requiere re-aprobación). La home muestra primero los destacados y completa hasta 4.
- Inventario público en español con filtros por marca, modelo, año, precio, kilometraje, combustible y transmisión.
- Ficha de vehículo en español, con botón "Consultar por WhatsApp" que envía marca, modelo, versión, año, precio y enlace.
- Se quitó el botón "Reservar este vehículo" (seña de USD 500 con tarjeta vía Stripe, no aplica a Elvis); se reemplazó por "Simular financiación".
- Test `tests/store-settings-save.test.cjs` actualizado para el monograma AE. Los 5 tests que fallan (módulo de chat IA) ya fallaban en el código original.

## Datos del negocio y modo demostración (realizado)
- Página **Nosotros** (`/nosotros`) con la información institucional; textos y redes en `features/storefront/lib/elvisContent.ts`.
- Home, footer y SEO con datos reales: venta a crédito hasta 100% (con la aclaración "sujeto a calificación y aprobación crediticia"), "Vendelo en Elvis", horarios y atención con turno.
- Perfil del negocio listo para cargar: `docs/elvis/perfil-elvis.sql`.
- **Modo demostración** (`DEMO_MODE`, `DEMO_PASSWORD`) para mostrar la propuesta sin que se indexe ni se confunda con el sitio oficial. Ver `docs/elvis/DEMO.md`.
