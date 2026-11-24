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
- Ronda 08:27: muestra local incluye Comparar y Créditos de fotos (antes daban 404); Comparar en español y con datos reales (combustible, caja, motor, deuda, GNC, cubiertas). Auditoría de botones y enlaces de la muestra: 0 rotos.
- Ronda 09:27: formularios de crédito y prueba de manejo probados en la muestra (se guardan). Turnos de prueba de manejo/servicio respetan el horario en español ("9 a 13 h" → 9, 10, 11 y 12 h) y los días "Cerrado" (sábado y domingo).
- Ronda 10:27: el calendario de prueba de manejo y de servicio deshabilita los días cerrados (sábados y domingos según el horario cargado).
- Ronda 11:27: panel local revisado en iPhone SE y iPad (sin desbordes ni botones chicos). Ficha del auto: botón Compartir (menú del celular o copia el enlace).
- Ronda 12:27: servidor.ps1 sin caracteres especiales y con BOM UTF-8 (evita que Windows PowerShell 5.1 lo lea mal y no arranque).
- Ronda 13:28: Consultas del panel local con buscador (nombre, teléfono, email, patente, auto) y filtro por estado.
- Ronda 14:28: Ventas del panel local → botón Comprobante (imprimir o guardar en PDF; documento interno, no fiscal).
- Ronda 15:27: Consultas del panel local muestran prioridad (alta/media/baja) de cada precalificación según sus respuestas, para ordenar a quién llamar primero.
- Ronda 16:27: tarjetas del Resumen del panel local llevan a su sección (Consultas nuevas abre Consultas filtradas). Fecha del comprobante en formato 20/11/2026 verificada.

### Ronda 20/11 17:30 — catálogo ampliado
- Catálogo: 55+ marcas (se sumaron Abarth, Changan, DFSK, Foton, GAC, Geely, Great Wall, GWM, JAC, Lexus, MG, Maxus, Smart, etc.) y modelos Ford faltantes (F-100, Focus II, S-Max…).
- Listas de marca con grupo "Más populares" arriba (Vende tu auto, Precalificador, panel Autos).

### Ronda 20/11 18:30 — catálogo completo
- Catálogo con CSV del usuario: 59 marcas, 1106 modelos, ~10.900 versiones (docs/elvis/*.csv).
- Años 1900 → año actual+1; marca/modelo/versión filtrados por año de fabricación (los que siguen en producción quedan abiertos a futuro).
- Opción "Aquí no aparece el mío" en marca, modelo y versión.
- Pendiente: hacer lo mismo en el filtro del inventario si se quiere.

### Ronda 20/11 19:30
- Precalificador (permuta): Año primero, luego Marca/Modelo filtrados por año y nuevo campo Versión.
- Ícono de pestaña: isotipo AE original (también en la muestra).
- El filtro del inventario usa las marcas del stock real (correcto, no usa el catálogo).

### 20/11 20:00 — ofertas, rifa, patente, títulos
- Panel → "Ofertas y rifas": renombrar Express/Progresivas/Rifa, crear/editar/ocultar/borrar secciones propias, rifas (crear, vender números, reservas desde la web, marcar pagado, liberar, sortear al azar entre pagados).
- Autos: campo Patente (buscable) y "Mostrar en ofertas" (No / Express / Progresiva con precio inicial, baja, cada cuánto, precio final y fecha / sección propia).
- /ofertas: secciones propias y rifa con grilla de números; en la muestra offline la progresiva (Meriva N7) queda siempre en curso.
- Títulos de pestaña "AE: Sección"; favicon con trazo más grueso.
- Pendiente online: pasar secciones y rifas a la base real. Rifas requieren autorización (Lotería de la Provincia).

### 20/11 20:10 — responsive, navegadores, analítica
- Auditoría de desborde horizontal a 320/360/768/1024/1440 px en 11 páginas: sin problemas.
- Analítica local en Resumen: visitas por día, páginas más vistas, conversión (consultas/visitas) y tiempo típico de carga. Sin servicios externos.
- Navegadores: probado solo en Chromium (Firefox/Safari no disponibles en el entorno). Pendiente: probar en Safari de iPhone y Firefox reales.
- Online: conectar analítica real (p. ej. Google Analytics o Plausible) cuando se publique.

### Ronda 20/11 20:30
- Panel: auditoría responsive con sesión iniciada (todas las pestañas a 320/768/1280 px): sin desbordes.
- Inicio: la oferta progresiva de la muestra offline también queda siempre en curso (antes solo en /ofertas).

### Ronda 20/11 21:30
- Prueba de manejo y turnos de taller: la confirmación mostraba fecha y hora en inglés ("Wed, Nov 25 · 9:00 AM"); ahora "miércoles, 25 de noviembre de 2026 · 09:00". Etiquetas del resumen del taller en español y precios con formato argentino.

### Ronda 20/11 22:30
- Revisión de textos en inglés visibles en 12 páginas: ninguno.
- Quitado el botón "Taller" de Contacto y de Mi cuenta (Elvis no tiene taller; /service redirige a Contacto y en la muestra daba 404). /service ahora existe en la muestra por si llega un enlace viejo.
- Recorrido de enlaces internos en la muestra: 35 páginas, ninguna rota.

### Ronda 20/11 23:30
- Muestra offline: guardado en la carpeta "datos" en fila (una escritura por vez, siempre la última). Antes, dos guardados seguidos podían llegar desordenados y pisar datos. Probado 3 veces: lo guardado en un navegador aparece en otro navegador nuevo (patente y rifa).

### Ronda 21/11 00:30
- "Vende tu auto" probado de punta a punta en celular: OK.
- Consultas: las reservas de rifa aparecían "Sin nombre" y sin tipo; ahora muestran el nombre y el tipo "Rifa" (filtrable).

### Ronda 21/11 01:30
- Probados de punta a punta: Financiación (celular) y Contacto (celular y escritorio): OK.
- Contacto: la confirmación ahora muestra también el horario elegido ("Por la mañana y por la tarde").

### Ronda 21/11 02:30
- Probado: alta de auto con foto desde el panel y que aparezca en la web (inicio, usados, ofertas, ficha): OK.
- Panel → Autos: la lista muestra la patente de cada auto.

### 21/11 02:40 — /ofertas con filtros
- Quitados los botones de arriba (Ofertas express / Progresivas / canal de WhatsApp).
- Filtros sobre las ofertas disponibles: tipo de oferta, 0 km/usado, marca, modelo, año desde/hasta, tipo de vehículo, tracción, tipo de tracción, combustible, caja, precio y km máximos. Las opciones muestran solo lo que existe en las ofertas.
- Orden: primero las secciones con ofertas disponibles; las vacías al final.
- Nuevos campos de auto en el panel: tipo de vehículo, tracción y tipo de tracción (si no se cargan, se deducen del modelo/versión).
- Datos de ejemplo: 4 autos de la base demo con precio anterior (ofertas express) en deploy/local/02-ofertas-ejemplo.sql.
- Online: carrocería/tracción hoy se deducen; cuando se publique, sumar esos campos a la base real.

### Ronda 21/11 03:30
- Ficha de cada auto: muestra Tipo de vehículo y Tracción (ej. Hilux: Pickup · 4x4 conectable), igual que los filtros de Ofertas.
- Pendiente opcional: sumar estos filtros también al Inventario.

### Ronda 21/11 04:30
- Panel → Autos: botón "Exportar a Excel" (CSV) con año, marca, modelo, versión, patente, stock, 0 km/usado, tipo de vehículo, tracción, km, precio, precio anterior, estado y oferta. Respeta el buscador.
- Filtros de carrocería/tracción en Inventario: quedan para cuando se pasen esos campos a la base real (hoy el inventario filtra en el servidor).
- /ofertas: en celular y tablet los filtros arrancan plegados (botón Filtrar); en escritorio siempre visibles.

### 21/11 05:40 — ventas con cliente y contrato, área de clientes
- Ventas: cliente registrado obligatorio (elegir de la lista o registrarlo en el momento: nombre, apellido, DNI, email, teléfono, domicilio), contrato adjunto (PDF/Word/foto, se guarda en "datos").
- Mails: AGENTS.md no permite construir envío automático de emails; quedan botones que abren el programa de correo con el mail de registro y el del contrato ya escritos (el contrato se adjunta a mano).
- Menú "Clientes" arriba; ingreso unificado (personal y clientes) con "Crear usuario" y "Olvidé mi usuario o contraseña" (muestra el usuario y ofrece pedir nueva contraseña por WhatsApp). Área de cliente: datos, compras y descarga del contrato.
- Pie: "Términos y condiciones de uso" (texto sin completar, modo demostrativo). Quitado "Créditos de fotos" del pie.
- Inventario → Filtros: título con la tipografía de la marca (mayúsculas), "Solo oferta progresiva" ahora es un botón dorado como los demás (antes casilla gris del sistema). Casillas de todo el sitio con el dorado de la marca.
- Filtros (Inventario y Ofertas): kilometraje "Desde / Hasta" (nuevo mínimo); se oculta y se limpia al elegir 0 km. Textos de los filtros centrados.
- Filtros del inventario: panel con borde y margen interno (antes pegado a los bordes), columna más ancha. Precio y kilometraje con puntos de miles al escribir (filtros de Inventario y Ofertas, y campos de precio/km/montos del panel).
- Logos de marcas (55, de las URLs que pasó el usuario) en public/images/marcas; se muestran en las listas de marca (Vende tu auto, Precalificador, panel Autos, filtros de Ofertas). Sin logo: Chrysler, Dodge, Land Rover y SEAT (no estaban en la lista).
- Encabezado: en escritorio el botón de WhatsApp es solo ícono para que no se superponga con el menú (incluido "Clientes"); revisado de 768 a 2560 px sin choques.
- Foto principal y del salón: se cargan directo del archivo (sin /_next/image), por si el iniciador de Windows no las sirve. Pendiente: el usuario ve la portada oscura/sin foto al abrir con el .bat (con file:// se ve bien); falta diagnosticar en su PC.
