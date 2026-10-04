# Catálogos y conexión con Google Sheets

Estado de esta entrega: libro local creado y validado; importación nativa a Google Drive y conexión remota pendientes de reactivar el conector. No se creó una planilla ni se configuró GitHub en nombre del usuario. `config/sheets.json` queda desactivado y sin URLs inventadas.

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

## Activación pendiente

1. Reactivar el conector de Google Drive e importar el XLSX como una hoja nativa dentro de la carpeta acordada.
2. Publicar **solamente las siete pestañas de catálogo** como CSV. No agregar cuentas, emails, contraseñas o datos de jugadores a este libro. La [documentación de Google](https://support.google.com/docs/answer/183965?hl=es) explica la publicación por hoja y formato.
3. Copiar las siete URLs CSV a `config/sheets.json`, activar `enabled` y ejecutar `node scripts/sync-catalog.mjs --check`. Este paso debe verificarse contra las URLs reales.
4. Subir la configuración junto con el incremental. El workflow `apex1000-catalog.yml` debe quedar en **`.github/workflows/` de la raíz de `servicios`**. El ZIP coloca el archivo allí; su copia dentro de `integration/` es una referencia.
5. En GitHub, permitir a Actions crear pull requests. Crear la variable de repositorio `APEX_SHEETS_ENABLED=true` para habilitar la comprobación cada seis horas. También puede ejecutarse manualmente en Actions.
6. El workflow valida todas las hojas, ejecuta las pruebas y propone un PR limitado a `Apex1000-Rally/data/catalog.json` y `catalog.js`. Revisar y fusionar para que el despliegue del repositorio publique los datos. Un push realizado con `GITHUB_TOKEN` no dispara por sí solo todos los workflows posteriores; por eso se usa un PR revisable. [Referencia oficial](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

Para comprobar el circuito completo sin acceso a Google: `node scripts/sync-catalog.mjs --source-dir catalogos --check`. Para regenerar el catálogo incluido: quitar `--check`. Los siete archivos se validan antes de escribir los resultados; un fallo de validación no reemplaza el catálogo vigente.

## Qué se conserva en cada partida

La partida guarda una copia del catálogo al inscribirse. Precios, stock, disponibilidad, calendario y premios de esa temporada se consultan desde esa copia. El stock disminuye con las compras locales. Las actualizaciones publicadas afectan campeonatos nuevos.

Sheets no recibe las compras ni los contratos del prototipo. La exclusividad se garantiza dentro de cada partida local. La exclusividad entre jugadores reales requerirá el servidor descrito en `ONLINE-MERCADO.md`.
