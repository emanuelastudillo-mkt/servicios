# Catálogo conectado a Google Sheets

Fuente: [Servicios Marketing Junio 2026](https://docs.google.com/spreadsheets/d/1W57cUM6iFoMkjhzJeTsCp3AKWBc46k7Xesxh5mUihZs/edit).

La acción **Actualizar servicios desde Google Sheets** está definida en `.github/workflows/actualizar-servicios.yml`. Está programada todos los días a las **07:17 de Argentina (10:17 UTC)**. También se puede ejecutar desde **Actions → Actualizar servicios desde Google Sheets → Run workflow → main**. El horario de GitHub puede demorarse; no es una ejecución al segundo. [Programación de GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Qué editar en la planilla

En **Servicios_Web** se leen `Nombre`, `Acciones`, `Costo`, `Requisitos`, `Presupuesto minimo mensual`, `Presupuesto maximo mensual` y `Estado`.

- **Disponible:** aparece entre las tareas seleccionables.
- **No disponible:** se conserva en `inactiveServices` del JSON y queda fuera del catálogo seleccionable.
- Usá `-` o una celda vacía para presupuestos publicitarios que no correspondan. El costo debe tener un número explícito; cero es válido.
- Los precios en formato argentino se convierten correctamente: `$30.000` equivale a 30000.
- Los servicios existentes conservan su ID al mantener el nombre. Si necesitás cambiar nombres sin perder la selección guardada de clientes, podés añadir una columna `id` con el identificador estable. No se agregó esa columna automáticamente.

En **Codigos_Web** se leen `Codigo` y `Descuento aplicado`. Usá porcentajes como `10%` o montos fijos como `$5.000`. Los descuentos se aplican a los honorarios conforme a las reglas existentes.

La pestaña **Otros** no se consulta. No se escribe nada en Google Sheets ni se cambia su acceso. Ambas pestañas ya permiten la lectura CSV utilizada por la acción; no hace falta agregar una contraseña o token de Google.

## Cómo se actualiza

1. Ejecuta las pruebas del conversor.
2. Descarga ambas pestañas y valida sus columnas, estados, valores y duplicados.
3. Actualiza únicamente `data.json` y, cuando cambia el contenido visible, la fecha de la portada en `sitemap.xml`.
4. Guarda un commit en `main`. `checkedAt` registra cada lectura exitosa; `updatedAt` cambia cuando cambian los datos. No se inventa una nueva fecha SEO si el contenido visible sigue igual.
5. Solicita explícitamente una compilación de GitHub Pages y verifica que el JSON publicado coincida con el generado. Esto es necesario porque un push con `GITHUB_TOKEN` no dispara por sí solo la compilación de Pages basada en una rama. [Publicación por rama](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [API de compilación](https://docs.github.com/en/rest/pages/pages#request-a-github-pages-build).

Se conserva la publicación existente desde `main` y la raíz `/`. No se reconstruye el repositorio desde la copia local: las carpetas de ejemplo del repositorio, incluida `facilauto`, permanecen intactas.

Si la descarga o validación falla, la acción muestra un error y no reemplaza el catálogo con datos vacíos o parciales. Si todas las filas dicen explícitamente `No disponible`, el catálogo queda sin tareas disponibles; el plan personalizado continúa funcionando. Una pestaña de servicios sin filas se considera un error. Una pestaña de códigos con encabezados y sin filas desactiva los cupones.

## Comprobar o ejecutar localmente

Desde la carpeta del sitio, con Node.js 24:

```sh
node --test scripts/sync-google-sheets.test.mjs
node scripts/sync-google-sheets.mjs --dry-run
node scripts/sync-google-sheets.mjs
```

`--dry-run` valida las lecturas sin escribir archivos. Los respaldos de la primera conexión local quedan fuera de la web, en `../respaldos/antes-sheets-2026-09-06/`. En GitHub se conserva el historial normal de commits.

Si cambiás la publicación de Pages a otra rama/carpeta o a un flujo personalizado, ajustá el paso de publicación de esta acción. Si deshabilitás Actions o revocás permisos, la actualización no podrá continuar. Las ejecuciones y cualquier fallo se consultan en la pestaña Actions del repositorio.
