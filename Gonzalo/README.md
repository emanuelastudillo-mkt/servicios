# Abuela Florentina — Web HTML

Sitio estático responsive para fábrica de tapas para empanadas.

## Arquitectura del catálogo

La web **no consulta Google Sheets ni Google Drive al navegar**.

1. La hoja de Google Sheets funciona como panel de edición.
2. Un workflow se ejecuta cada 6 horas.
3. `scripts/sync-catalog.mjs` descarga el CSV de la hoja.
4. Las fotos enlazadas desde Google Drive se descargan a `assets/products/`.
5. Se genera `data/catalog.json` con precios, variedades y rutas locales.
6. `index.html` consume únicamente ese JSON local.

Así la web sigue funcionando aunque Sheets o Drive estén lentos o temporalmente inaccesibles.

## Columnas sugeridas en Google Sheets

Crear una pestaña llamada `Catalogo` con esta primera fila:

`id | nombre | variedad | presentacion | precio | foto | activo | destacado | orden`

- `id`: identificador simple y único, por ejemplo `criolla-12`.
- `nombre`: por ejemplo `Tapas para empanadas`.
- `variedad`: `Masa Criolla` o `Masa Hojaldrada`.
- `presentacion`: texto libre.
- `precio`: número, sin necesidad de `$`.
- `foto`: enlace compartido de Google Drive o una URL de imagen pública.
- `activo`: `SI` / `NO`.
- `destacado`: `SI` / `NO`.
- `orden`: 1, 2, 3...

## Configurar sincronización cada 6 horas con GitHub Actions

1. Subir esta carpeta a un repositorio GitHub.
2. Publicar la pestaña de Sheets como CSV o usar una URL CSV accesible por el workflow.
3. En GitHub: `Settings → Secrets and variables → Actions`.
4. Crear el secret `SHEET_CSV_URL` con la URL CSV.
5. Habilitar GitHub Actions.
6. El workflow `.github/workflows/sync-catalog.yml` ejecutará la sincronización cada 6 horas.

También puede ejecutarse manualmente desde la pestaña Actions.

## Hosting

Funciona como sitio estático en GitHub Pages, Netlify, Vercel o un hosting HTML tradicional. Si se publica en GitHub Pages desde la misma rama, cada commit automático actualiza el catálogo del sitio.

## WhatsApp

Número configurado: `+54 9 11 6126-4371`.

## Archivos principales

- `index.html`: estructura del sitio.
- `css/styles.css`: diseño responsive.
- `js/app.js`: carga y filtrado del catálogo.
- `data/catalog.json`: copia local del catálogo.
- `scripts/sync-catalog.mjs`: sincronizador.
- `.github/workflows/sync-catalog.yml`: automatización cada 6 horas.
