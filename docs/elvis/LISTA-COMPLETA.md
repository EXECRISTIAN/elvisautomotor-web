# Elvis Automotores — lista completa de lo que falta, cambiar o revisar

Estado al 24/11/2026. Los puntos marcados ✅ ya están hechos.
Marcas: 🔴 importante · 🟡 conviene · ⚪ menor / opcional. Entre paréntesis: quién lo resuelve.

## 1. Depende de Elvis (datos o decisiones)
1. 🔴 Aprobar el logo AE recreado (`docs/elvis/logo/`) o pasar el original en buena calidad. (Elvis)
2. 🔴 Fotos reales de cada auto del stock y del salón; hoy hay fotos de ejemplo y algunas con crédito de autor obligatorio. (Elvis)
3. 🔴 Stock real: lista de autos con precio, km, versión, patente, estado. Hoy son 14 autos de demostración. (Elvis)
4. 🔴 Confirmar dirección: la web dice Andrés Baranda 2134, Quilmes; Google Maps/Linktree dice Av. Los Quilmes 735, Bernal. ¿Dos sedes? (Elvis)
5. 🔴 Confirmar si venden usados o solo 0 km + Plan Canje (su asistente de WhatsApp dice "venta de usados suspendida"). (Elvis)
6. 🔴 Confirmar si atienden llamadas (la web muestra el fijo; el asistente dice que no). (Elvis)
7. 🔴 Planes de financiación reales que ofrece en el salón (Banco Nación / Provincia u otros), gastos de otorgamiento y CFT. (Elvis)
8. 🟡 Horarios exactos (hoy: lun–vie 9 a 13 h, sábado y domingo cerrado). (Elvis)
9. 🟡 Texto de "Términos y condiciones de uso" (hoy solo el título, como pediste). (Elvis / abogado)
10. 🟡 Rifa: autorización de Lotería de la Provincia o del municipio antes de usarla de verdad. (Elvis)
11. 🟡 Número de WhatsApp definitivo y canal de WhatsApp (hoy 11 2723-5886). (Elvis)
12. ⚪ Textos de "Nosotros" (historia, desde cuándo, equipo). (Elvis)
13. ⚪ Logos de Chrysler, Dodge, Land Rover y SEAT (no estaban en la lista de Kavak). (vos / yo)
14. ⚪ Capturas restantes del precalificador de Elvis 2.0 (dijiste que mandarías más). (vos)

## 2. Para publicar online
15. 🔴 Acceso al dominio elvisautomotores.com (Squarespace) o que Elvis cambie los DNS. (Elvis)
16. 🔴 Elegir hosting (servidor para la web + base de datos) y almacenamiento de fotos. (vos / yo)
17. 🔴 Pasar a la base de datos real todo lo que hoy vive solo en la muestra: ventas, caja, cierres, clientes registrados, área de clientes, contratos, usuarios y permisos, secciones de ofertas, ofertas progresivas creadas desde el panel, rifas, edición del sitio, analítica. (yo)
18. 🔴 Cambiar el usuario/contraseña 123/123 y crear los usuarios reales del personal. (vos / yo)
19. ✅ Campos "tipo de vehículo", "tracción" y "tipo de tracción" en la base real (hecho; si quedan vacíos se deducen del modelo).
20. 🔴 Mails: hoy se abren armados en tu programa de correo (las reglas del proyecto no permiten envío automático). Decidir si online se mantiene así o se cambian las reglas. (vos)
21. 🟡 Analítica real (Google Analytics o similar), Google Search Console y Perfil de Empresa de Google. (yo + acceso de Elvis)
22. 🟡 Copias de seguridad automáticas de la base de datos. (yo)
23. 🟡 Comprobante de venta: hoy es "no fiscal". Si quieren factura electrónica (AFIP/ARCA), hay que integrarla. (Elvis / contador)

## 3. Web pública — agregar o cambiar
24. ✅ Inventario: filtros de tipo de vehículo, tracción y tipo de tracción (hecho).
25. ✅ Inventario: orden "mayor descuento" (hecho).
26. ✅ Portada: versión para celular de 139 KB (antes 658 KB).
27. 🟡 Quitar los créditos de autor de las fotos de ejemplo cuando se reemplacen por fotos propias.
28. ➡️ "Clientes" online: queda incluido en el punto 17 (pasar el área de clientes a la base real).
29. ✅ Prueba de manejo con el auto ya elegido: verificado desde la ficha y por enlace, online y en la muestra.
30. ⚪ Ficha del auto: mostrar patente parcial (ej. AB***CD) si Elvis quiere.
31. ✅ Página "Términos" propia (/terminos, enlazada desde el pie; texto pendiente).
32. ✅ Página 404 con buscador y accesos rápidos.

## 4. Panel de administración — agregar o cambiar
33. ✅ Ventas: editar una venta (botón Editar; no toca la caja).
34. ✅ Clientes: editar, borrar y ver historial (compras + consultas).
35. ✅ Consultas: asignar a un vendedor y notas internas con fecha.
36. ✅ Autos: duplicar un auto y ordenar fotos con flechas.
37. ✅ Caja: rango de fechas y neto por medio de pago.
38. ✅ Resumen: mes actual contra el anterior.
39. ✅ Rifas: imprimir talonario.
40. ✅ Actividad: filtro por usuario y fechas.
41. ✅ Respaldo automático diario de datos.json en datos
espaldos (últimas 30).

## 5. Muestra offline (sin instalar nada)
42. 🔴 Probar en tu PC con Windows el último zip: que la portada se vea bien con el .bat sin Ctrl+F5 (arreglo de copias viejas, no probado en Windows).
43. 🟡 Probar en Safari (iPhone) y Firefox: acá solo se prueba en Chrome.
44. ✅ El .bat avisa si el puerto 8080 está ocupado.

## 6. Calidad y revisión técnica
45. ✅ Accesibilidad: revisión automática (WCAG A/AA) de todas las páginas y del panel, 0 errores; corregidos contraste, etiquetas y botones sin nombre.
46. ✅ SEO: títulos y descripciones revisados, enlace canónico en fichas, punto doble corregido; las fichas ya tenían datos estructurados.
47. ⚪ 5 pruebas automáticas viejas del proyecto original fallan (tests/family-security), no afectan a Elvis.
