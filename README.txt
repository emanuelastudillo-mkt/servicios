WEB EMANUEL ASTUDILLO — REDISEÑO 06/09/2026

La versión estática rediseñada está lista en esta carpeta. No se publicó automáticamente.

ARCHIVOS NECESARIOS
- index.html
- robots.txt
- sitemap.xml
- assets/styles.css
- assets/app.js
- assets/data-core.js
- assets/favicon.svg
- assets/emanuel-astudillo.png
- data.json (sin cambios)
- favicon.ico y CNAME (sin cambios)

Para actualizar el hosting existente, subí index.html, robots.txt, sitemap.xml y toda la carpeta assets, conservando el resto de los archivos y carpetas del sitio. Esta versión necesita assets además de index.html y data.json.

REGISTRO EN BUSCADORES
La guía ../REGISTRAR-WEB-GOOGLE-BING.md explica cómo publicar los archivos, verificar la propiedad en Google Search Console y Bing Webmaster Tools y enviar el sitemap. La preparación local no registra ni publica el sitio automáticamente. Las carpetas de ejemplo se excluyen del sitemap y su rastreo se bloquea en robots.txt; esto por sí solo no garantiza su exclusión de los resultados de búsqueda.

No borres ni reemplaces las carpetas Diego, Gonzalo, Sabrina y Tito. No se modificaron y no están enlazadas desde la web principal; continúan accesibles por sus rutas directas. Estar fuera de la navegación no equivale a protección con contraseña.

DATOS Y REGLAS CONSERVADOS
El catálogo sigue leyendo ./data.json. No hay conexión de escritura a Google Drive o Google Sheets. Se conservaron IDs, costos, presupuestos mínimos/máximos, requisitos, códigos y reglas de bonificación.
- 1 tarea paga normal: auditoría bonificada.
- 2 tareas pagas normales distintas: dashboard bonificado.
- Auditoría y dashboard no activan por sí mismos esos beneficios.
- Los descuentos afectan los honorarios, no la inversión mínima en Meta.
- La inversión mínima se suma por tarea y cantidad conforme a la lógica original.

PRESENTACIÓN
Los textos editoriales se definen en assets/app.js. Los precios siempre salen de data.json. Las descripciones originales y los requisitos siguen visibles en “Ver alcance y requisitos”. Si cambia el título o la descripción en data.json, el dato actualizado tiene prioridad sobre la reescritura anterior.

PLAN PERSONALIZADO
Se agrega separado del catálogo, con la etiqueta “A cotizar” y sin precio asignado. No altera descuentos, cálculos ni bonificaciones. Puede combinarse con tareas presupuestadas; el resumen aclara que su costo no está incluido. El cliente puede describir su necesidad.

COMPARTIR Y EXPORTAR
- WhatsApp: abre el número original con el resumen y la consulta preparados. El cliente decide cuándo enviarlo.
- Copiar resumen: copia el texto o muestra un cuadro para copiarlo manualmente si el navegador bloquea el portapapeles.
- Guardar PDF: abre un presupuesto imprimible y el diálogo del navegador; elegir “Guardar como PDF”. Requiere permitir la ventana emergente.
- El plan se conserva localmente en el navegador. Los datos ingresados no se transmiten automáticamente.

VISTA LOCAL
Servir esta carpeta por HTTP para que el navegador pueda cargar data.json. No abrir index.html directamente como file://.
Ejemplo si Python está instalado:
python -m http.server 4173 --bind 127.0.0.1
Abrir http://127.0.0.1:4173/

La tipografía se carga desde Google Fonts, con fuentes locales de reemplazo cuando no hay conexión. Los gráficos y efectos son CSS/SVG, sin videos ni librerías de animación. Se respeta la preferencia de movimiento reducido.

RESPALDO Y VERIFICACIÓN (FUERA DE ESTA CARPETA)
../respaldos/antes-del-rediseno-2026-09-06/ contiene el index.html y el README anteriores, más el inventario SHA-256 de los 48 archivos originales.
../verificacion/ contiene pruebas, capturas y reportes.
- 13.122 comparaciones de cálculo coincidieron con la versión anterior.
- Navegador: escritorio/móvil, 320/390/768/1024/1440 px, sin desbordamiento horizontal.
- Verificados: bonificaciones, códigos, cantidades, persistencia, plan personalizado, enlaces de WhatsApp, copiar, imprimir, recuperación del catálogo y movimiento reducido.
- Verificada la integridad de data.json, CNAME, archivos auxiliares y webs de ejemplo.
