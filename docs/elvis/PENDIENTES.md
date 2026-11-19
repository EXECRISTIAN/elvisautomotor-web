# Elvis Automotores — pendientes y material para mostrar

## Material listo para mostrar al dueño
- **Isotipo AE original vectorizado tal cual** (mismos trazos, espacios y colores neón; 99% de coincidencia con el JPG original): `docs/elvis/logo/isotipo-original/` (SVG con fondo negro y transparente, PNG 2048 px).
- **Logo AE recreado** (aprobado por el autor del proyecto): `docs/elvis/logo/`
  - `elvis-logo-completo.svg` / `-fondo-negro.png` / `-transparente.png`: imagotipo final (isotipo AE redibujado del original + barra + "ELVIS AUTOMOTORES"). En la web va como un único SVG embebido (`features/storefront/components/ElvisLogo.tsx`).
  - `elvis-ae-monograma.svg` / `elvis-ae-monograma.png` (solo AE, fondo transparente)
  - `elvis-texto.svg` / `elvis-texto-fondo-negro.png` / `elvis-texto-transparente.png` (solo "ELVIS AUTOMOTORES" con la línea divisoria)
  - `elementos/`: cada pieza por separado (monograma AE, línea divisoria, "ELVIS", "AUTOMOTORES") en SVG y PNG (fondo negro y transparente)
- Capturas de cada etapa: `docs/elvis/etapa*.png`, `docs/elvis/demo-nosotros.png`
- Demo con contraseña: ver `docs/elvis/DEMO.md`

## Falta definir / conseguir
- ~~Número de WhatsApp~~ cargado: 11 2723-5886 (responde un asistente automático de Meta). Fijo: (011) 4259-1365.
- **A confirmar con Elvis** (dicho por su asistente de WhatsApp, puede estar desactualizado):
  - "Solo vendemos 0 km; venta de usados suspendida; el usado solo como parte de pago (Plan Canje)". La web sigue mostrando usados y "Vendelo en Elvis" porque se vio que siguen vendiendo usados.
  - "No atendemos llamadas" (la web muestra el teléfono fijo).
  - Su formulario de precalificación: https://formularioatenciononline.netlify.app/ (no se pudo leer: dominio bloqueado en esta sesión).
- Tasas y condiciones reales de Banco Nación y Banco Provincia (los bancos ya están creados, sin planes).
- Fotos reales de autos y del salón (la foto del hero es de demostración).
- Publicar la URL temporal (Railway) — ver `docs/elvis/DEMO.md`.
- Confirmar con el cliente el uso de su marca, logo y textos antes de producción.

## Hecho recientemente (sitio público)
- Precios en pesos sin límite práctico (antes el máximo era $21.474.836).
- Vendelo en Elvis con hasta 8 fotos y sin tasación automática inventada.
- Financiación: bancos y planes cargables, simulador estimativo y solicitud. **Faltan cargar los planes reales de los bancos** (hoy se cargan desde Panel → Tablas → Bancos / Planes de financiación).

- Ofertas progresivas: página /ofertas, sección en el inicio, filtro en inventario, precio y cuenta regresiva en vivo, baja por hora o por día. Se cargan desde Panel → Tablas → Ofertas progresivas (falta pantalla propia del panel). Ejemplo N7 en `perfil-elvis.sql`.

## Etapas restantes
3. Panel administrativo en español y simplificado — EN CURSO. Hecho: menú, marca, formato es-AR/ARS/km, Configuración, Inventario, Consultas, Clientes, Usados ofrecidos, Pruebas de manejo, Solicitudes de crédito. Falta (parte 3): Operaciones, Personal/roles, Resumen, Estadísticas, Organización, Catálogo, Reportes, pantallas de ingreso.
4. Financiación bancaria — HECHO en la web; falta pantalla propia en el panel (hoy se usa Tablas).
5. Vendelo en Elvis — HECHO en la web; falta ver las fotos dentro de la ficha del usado en el panel (hoy en Tablas → Fotos de usados).
6. Calidad, seguridad y SEO final.
