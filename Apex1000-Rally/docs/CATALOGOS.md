# Catálogos y conexión con Google Sheets

Planilla administrativa: [Apex1000-Catalogos en Google Sheets](https://docs.google.com/spreadsheets/d/1RnlQEN6uLO1nxxxXP74Q2sl1AGmUrqwsk1MpJuOF3qk/edit). Es una hoja nativa con guía y siete pestañas de datos. Las siete exportaciones CSV están publicadas con republicación automática, y `config/sheets.json` contiene sus enlaces reales con `enabled: true`. El Excel original y los CSV locales se conservan como respaldo; la fuente de las actualizaciones diarias es la planilla nativa.

Destino acordado: https://drive.google.com/drive/folders/18QOIC22BHnWJTpkL5ubRJ82AzUkuGs2I

El libro `catalogos/Apex1000-Catalogos.xlsx` contiene una guía y siete hojas. También se incluyen CSV individuales. Todos los importes son créditos ficticios; los sueldos son por carrera. `available` acepta TRUE/FALSE y los números se escriben sin separadores de miles. Para decimales se admite punto o coma.

| Hoja | Qué administra |
| --- | --- |
| Vehiculos | 4 modelos, precio de compra y stock inicial |
| Repuestos | 6 tipos × 3 calidades × 3 estados: 54 ofertas con precio y stock |
| Pilotos | 6 identidades, perfil, sueldo mínimo y disponibilidad |
| Mecanicos | 8 identidades, sueldo mínimo, eficiencia y disponibilidad |
| Carreras | 8 pruebas, día de largada y multiplicador del premio |
| Premios | Puntos y premios por posición de carrera y campeonato |
| Ajustes | Presupuesto inicial, duración de ofertas y límites 3/5 |

Conservar IDs, encabezados y cantidad de filas. El importador rechaza duplicados, valores no numéricos, stocks negativos, rutas de imagen ajenas al catálogo y límites de personal distintos de los acordados. La configuración física de vehículos y piezas sigue en `src/catalog.js`; esta versión de la planilla administra la economía y los contratos.

## Conexión instalada

1. El XLSX se convirtió en una hoja nativa dentro de la subcarpeta `catalogos` del destino acordado, conservando el original. Editar la planilla enlazada arriba, no el archivo `.xlsx`.
2. Están publicadas **solamente las siete pestañas de catálogo** como CSV, sin la guía. No agregar cuentas, emails, contraseñas o datos de jugadores a este libro. La [documentación de Google](https://support.google.com/docs/answer/183965?hl=es) explica la publicación por hoja y formato.
3. Las siete URLs están en `config/sheets.json`. `node scripts/sync-catalog.mjs --check` verifica las hojas reales sin modificar los archivos del juego.
4. El workflow operativo está en **`.github/workflows/` de la raíz de `servicios`**. El incremental incluye esa ubicación y una copia de referencia dentro de `integration/`.
5. El workflow se ejecuta todos los días a las **07:23 de Argentina (10:23 UTC)**. GitHub puede demorar el inicio. También puede lanzarse desde Actions → Apex1000 - catálogo diario → Run workflow. No necesita la variable `APEX_SHEETS_ENABLED` ni crear pull requests.
6. Valida las siete hojas y ejecuta las pruebas. Si hay cambios, guarda automáticamente sólo `Apex1000-Rally/data/catalog.json` y `catalog.js` en `main`. Si falla la descarga, la validación o las pruebas, no publica los datos. Un cambio simultáneo de `main` hace fallar el push antes que sobrescribirlo.
7. Comprueba que el JSON y el módulo JavaScript públicos coincidan con el catálogo validado. Si no coinciden, solicita un build de GitHub Pages y espera su publicación. Se usa el permiso `pages: write` porque el push de `GITHUB_TOKEN` no dispara por sí solo todos los workflows posteriores. [Referencia oficial](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

## Edición y seguimiento diario

Editar los valores en las pestañas originales de Google Sheets. Conservar IDs, encabezados y filas; no reemplazar el documento por otra copia. Mantener la republicación automática de las hojas CSV. Los cambios guardados antes de la ejecución diaria se incorporan en esa ejecución, sujetos a la demora de Google al publicar y de GitHub al programar.

Para revisar el resultado, abrir [Actions del catálogo](https://github.com/emanuelastudillo-mkt/servicios/actions/workflows/apex1000-catalog.yml). El resumen distingue la conexión pendiente de una publicación verificada. Una ejecución fallida incluye el motivo en el paso correspondiente. Corregir la celda indicada y ejecutar Run workflow o esperar el día siguiente. GitHub puede desactivar cron en repositorios públicos después de 60 días sin actividad; en ese caso hay que reactivar el workflow en Actions.

El flujo diario actualiza el catálogo del sitio. Una pestaña del juego que ya estaba abierta debe recargarse para leer la versión nueva. No se modifica la economía de una partida en curso.

Para comprobar el circuito completo sin acceso a Google: `node scripts/sync-catalog.mjs --source-dir catalogos --check`. Para regenerar el catálogo incluido: quitar `--check`. Los siete archivos se validan antes de escribir los resultados; un fallo de validación no reemplaza el catálogo vigente.

## Qué se conserva en cada partida

La partida guarda una copia del catálogo al inscribirse. Precios, stock, disponibilidad, calendario y premios de esa temporada se consultan desde esa copia. El stock disminuye con las compras locales. Las actualizaciones publicadas afectan campeonatos nuevos.

Sheets no recibe las compras ni los contratos del prototipo. La exclusividad se garantiza dentro de cada partida local. La exclusividad entre jugadores reales requerirá el servidor descrito en `ONLINE-MERCADO.md`.
