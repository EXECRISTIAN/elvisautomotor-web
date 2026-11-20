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

## Hecho recientemente (sitio público)
- Precios en pesos sin límite práctico (antes el máximo era $21.474.836).
- Vendelo en Elvis con hasta 8 fotos y sin tasación automática inventada.
- Financiación: bancos y planes cargables, simulador estimativo y solicitud. **Faltan cargar los planes reales de los bancos** (hoy se cargan desde Panel → Tablas → Bancos / Planes de financiación).

- Ofertas progresivas: página /ofertas, sección en el inicio, filtro en inventario, precio y cuenta regresiva en vivo, baja por hora o por día. Se cargan desde Panel → Tablas → Ofertas progresivas (falta pantalla propia del panel). Ejemplo N7 en `perfil-elvis.sql`.

## Etapas (estado al 20/11/2026)
1–2. Identidad visual, inicio e inventario — HECHO.
3. Panel administrativo en español — HECHO: todas las secciones visibles, interfaz de Tablas, alta de personal simplificada, roles en español. Las secciones ocultas para Elvis (Taller, Repuestos, Pagos, Contabilidad, Entregas, API) siguen en inglés porque no se usan.
4. Financiación bancaria — HECHO. Bancos y Planes tienen acceso directo en el menú (Financiación). **Faltan las tasas reales de Elvis.**
5. Véndelo en Elvis — HECHO, incluidas las fotos dentro de la ficha del usado en el panel.
6. Calidad — HECHO: datos para Google, velocidad (todas las páginas < 1 s en local), revisión de accesibilidad en celular.
7. Usuarios y roles — HECHO: roles en español (Administrador, Gerente de ventas, Vendedor, Responsable de créditos, Administración…), alta de vendedores probada de punta a punta.

## Lo único que falta (depende de Elvis o de publicar)
- Confirmar con Elvis cuáles de estos planes ofrece en el salón y si hay gastos de otorgamiento/CFT (los bancos no los publican).
- Fotos reales de autos y del salón.
- Publicar: dominio/hosting, almacenamiento de fotos (S3 o similar), Google Search Console y Perfil de Empresa.

## Actualización (19/11/2026)
- Quitada la franja "Propuesta de sitio web — versión de demostración" del sitio.
- Base de datos de ejemplo completa en `deploy/local/` + `docker-compose.yml` para correr todo en la PC (ver `PC-LOCAL.md`).
- Muestra offline regenerada sin la franja (`elvis-muestra-offline.zip`, 14 vehículos).
- Agregadas redes del Linktree: YouTube, Spotify, Instagram y Facebook de "Elvis Viaja", y X (@autoselvis).
- Teléfono fijo ahora marca en formato internacional (+54 11 4259-1365).
- **Por confirmar con Elvis:** la ficha de Google Maps del Linktree dice *Av. Los Quilmes 735, Bernal*; el sitio usa *Andrés Baranda 2134, Quilmes*. ¿Son dos sedes o cambió la dirección?
- Imagen Docker probada de punta a punta (20/11): base de ejemplo, sitio con inventario y acceso al panel.
- Siguen pendientes: panel de administración (traducción final, pantallas propias) y usuarios/roles.

## Ronda automática 1 (20/11/2026)
- Ficha del vehículo en celular: la barra fija ahora tiene botón de WhatsApp con el auto y el precio ya escritos en el mensaje (antes solo había un formulario). Si no hay número cargado, vuelve a mostrar "Consultar". Probado en iPhone SE y iPhone 13, sin desbordes. Captura: `muestra/ficha-barra-whatsapp-celular.png`.

## Ronda automática 2 (20/11/2026)
- SEO: datos estructurados para Google (schema.org). Todas las páginas declaran la agencia (AutoDealer: nombre, dirección, teléfono, email, mapa y redes) y cada ficha declara el vehículo (Car: marca, modelo, año, km, combustible, caja, motor, precio y disponibilidad). Solo usa datos cargados en el panel.
- Al publicar: validar con la "Prueba de resultados enriquecidos" de Google y cargar el sitio en Google Search Console / Perfil de Empresa.

## Bloque completo (20/11/2026)
- Panel traducido: Resumen, Operaciones, Estadísticas, Personal, Organización, Catálogo, Reportes, Tablas (crear/editar/borrar/filtros/paginación), mensajes de error y conteos.
- Menú lateral: accesos directos a Ofertas progresivas, Bancos y Planes de financiación. "Tablas" muestra solo las 17 tablas útiles, con nombres en español.
- Alta de integrante: formulario corto en español (nombre, email, contraseña, rol, teléfono, vendedor / créditos).
- Zona horaria por defecto: Buenos Aires (antes Nueva York; afectaba horarios de citas y ofertas).
- Ficha del usado en el panel: galería con las fotos que mandó el cliente.
- Sitio: enlace "X (Twitter)" del pie más fácil de tocar; página Comparar explica cómo usarla.

## Tasas reales cargadas (20/11/2026)
Fuentes públicas: anuncios de los bancos difundidos por Infobae, La Nación, iProfesional, El Cronista (nov. y sep. 2026).
- Banco Nación "+Autos con BNA" (05/11/2026): préstamo personal sin prenda, tasa fija en pesos, hasta $50 M, hasta 100 %, hasta 72 meses, 0 km y usados de hasta 10 años.
  - 25 % TNA con sueldo/jubilación en el banco + tarjeta BNA + seguro con Nación Seguros.
  - 46 % TNA general.
- Banco Provincia "Acá Tu Auto": hasta $50 M, hasta 100 %, en concesionarias adheridas.
  - Tasa fija en pesos desde 55 % TNA (cobro de haberes en el banco) y desde 65 % (resto, hasta 75 %), 12 a 72 meses.
  - Opción UVA desde UVA + 6 % (12 a 48 meses): el simulador no la calcula; se informa en el texto del plan.
- El simulador ahora suma IVA (21 %) sobre los intereses: reproduce exacto el ejemplo de BNA ($15 M a 36 meses → $662.022 al 25 % y $895.841 al 46 %).
- Se quitó el "Banco de ejemplo".
- Dirección definida: Andrés Baranda 2134, Quilmes, Provincia de Buenos Aires, Argentina.

## Dominio elvisautomotores.com (verificado 20/11/2026)
- Es de Elvis: www.elvisautomotores.com muestra un sitio de Google Sites con su texto institucional, "Elvis Automotores SRL", elvisautomotores@gmail.com y 4259-1365. Secciones: Sobre Nosotros, Vendelo en Elvis, Contacto y Redes.
- Registrado el 09/06/2024 en Squarespace Domains (ex Google Domains); vence el 09/06/2027. DNS en Google Cloud DNS.
- Solo funciona con "www": elvisautomotores.com (sin www) no abre.
- Para publicar el sitio nuevo ahí hace falta que Elvis dé acceso a la cuenta de Squarespace/Google donde está el dominio (o que cambie él los DNS). El sitio viejo de Google Sites se reemplaza.

## Fotos reales de Elvis (20/11/2026)
- Portada y "Nosotros": foto real del frente del salón (Google Maps, subida por la cuenta AUTOMOTORES ELVIS, sep. 2026, 2400×1800). También es la imagen al compartir el link.
- "Compramos tu usado" (inicio): foto del salón por dentro (Instagram, 640×480).
- Originales en `docs/elvis/fotos-redes/`.
- Ficha de Google Maps: 4,1 ★ con 2.404 opiniones, 547 fotos; confirma Andrés Baranda 2134, C1878 Quilmes; el teléfono no está cargado en Maps (sugerirle agregarlo).
- No se pudo bajar más: Google Maps, Facebook e Instagram piden iniciar sesión para ver galerías completas. Las publicaciones recientes de Instagram son cuadros de video con clientes (no se usan caras de clientes).
- Para el inventario real hacen falta fotos de cada auto en buena resolución: pedírselas a Elvis o bajarlas con su cuenta.

## Bloque 20/11/2026 (tarde)
- Portada: accesos "Autos 0 km" y "Autos usados" (también en el menú del celular).
- Ficha del usado: informe de estado (deuda, infracciones, GNC, aire, cubiertas, motor, chapa, pintura, plásticos, interior, mecánica, funcionamiento, llantas). **Datos de ejemplo inventados**: reemplazar por los reales desde el panel (Inventario → vehículo → "Estado del usado").
- Ofertas express: cargando "Precio anterior" en un auto aparece rebajado (precio tachado). Hoy no hay ninguna: se ve el cartel "No hay ofertas express en curso".
- Financiación: botón "Otra cantidad" de cuotas (dentro del rango del plan) y acceso al precalificador.
- **Precalificador** (/precalificador): copia del flujo de captación de Elvis 2.0 (WhatsApp, 0 km/usado, contado/financiado, permuta, tipo de 0 km, cuota, situación laboral, ingresos, tarjetas, créditos, Veraz, cuándo, por qué Elvis, horario, DNI/CUIL). Llega al panel como consulta con todas las respuestas.
  - **Por confirmar con Elvis:** en su sistema dice "la reapertura de la agencia de usados está prevista para el primer trimestre de 2027". No se copió ese texto; en el sitio los usados se muestran normalmente.
- Véndelo en Elvis: patente (obligatoria) y número de motor; selectores con lista debajo; catálogo de 31 marcas / 256 modelos / 769 versiones.
- Contacto: opción WhatsApp, franja mañana/tarde (una o las dos), botón "Quiero que me contacten".
- Botón "Noticias y ofertas por WhatsApp" (canal) en inicio, ofertas y pie.
- Panel en la PC: usuario **123** / contraseña **123** (solo local; cambiar antes de publicar). `INICIAR-ELVIS.bat` levanta todo con Docker Desktop y guarda los datos en la PC.
- Muestra rápida: `INICIAR-MUESTRA.bat` (menús y simulador funcionan; no guarda datos).
- Se quitó "Basado en Openfront (MIT)" del pie (la licencia sigue en el repositorio, que es lo que exige).

## Muestra local completa (20/11/2026, noche)
- Todo se guarda en la carpeta `datos/` junto a INICIAR-MUESTRA.bat (consultas, usuarios, autos, ventas, caja, fotos, ajustes del sitio).
- Fotos: galería/archivos o cámara (celular) / webcam (computadora), en Vende tu auto y en el panel.
- Link de la publicación del auto (Vende tu auto y precalificador).
- Panel local (/panel, 123/123): Resumen, Consultas, Autos, Ventas, Caja (cierre con arqueo), Clientes, Sitio (textos, contacto, aviso, colores), Usuarios, Permisos por rol, Actividad. Exportación a Excel en cada sección.
- El sitio público refleja lo cargado en el panel (autos nuevos, precios, ofertas express, vendidos, textos y colores).
- Para la versión online: pasar estas funciones (ventas, caja, permisos, edición del sitio) al panel real con base de datos.
- Ronda 07:27: panel local → Sitio → "Respaldo de datos" (descargar y cargar una copia de todo). Probado.
