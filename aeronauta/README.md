# Aeronauta · Juego para GitHub Pages

Primera versión jugable en español, ambientada en 2026.

## Subir y jugar (sin instalar ni compilar nada)

1. Descomprimí este ZIP en tu computadora.
2. Creá un repositorio en GitHub. Para usar GitHub Pages con una cuenta gratuita, crealo público.
3. Subí **el contenido descomprimido** a la raíz del repositorio. Deben verse `index.html`, `assets/`, `world.geojson`, `favicon.svg` y `.nojekyll` en ese nivel. No subas solamente el ZIP ni una carpeta contenedora adicional.
4. Entrá en **Settings → Pages**. En **Source**, elegí **Deploy from a branch**. Seleccioná **main**, **/(root)** y pulsá **Save**. Si tu rama tiene otro nombre, elegí esa rama.
5. Esperá la publicación y abrí el enlace que mostrará GitHub Pages. Será parecido a `https://TU-USUARIO.github.io/TU-REPOSITORIO/`.

**Importante:** `.nojekyll` es un archivo oculto y vacío. Está incluido en el ZIP; asegurate de subirlo. Si no aparece al cargar los archivos, creá uno con ese nombre en la raíz desde GitHub.

La publicación puede tardar unos minutos. Una subida de archivos a GitHub por sí sola no activa Pages: completá el paso 4. El paquete usa rutas relativas y admite cualquier nombre de repositorio, además de un dominio propio.

Guía oficial: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Cómo empezar

La partida inicial trae dos rutas desde Buenos Aires. En **Nueva aerolínea** podés elegir nombre y base y comenzar desde cero con US$ 240 millones.

Comprá aviones, abrí rutas, ajustá tarifas y frecuencias, y avanzá un trimestre. El objetivo es operar ocho rutas y cerrar un trimestre con ganancias. Podés seguir jugando después de lograrlo.

## Guardado

La partida se guarda en este navegador. En **Finanzas** podés descargarla y cargarla en otro dispositivo. Para trasladar una partida desde la versión de Sites, descargala allí y cargala en GitHub Pages; los guardados automáticos no se comparten entre dominios.

## Qué contiene el ZIP

- Juego compilado en la raíz: listo para publicarse.
- `assets/`: código y estilos del juego.
- `world.geojson`: mapa mundial.
- `fuente/`: código editable, pruebas e instrucciones para recompilar.

No hace falta instalar Node.js, pnpm ni ninguna dependencia para subir y jugar la versión compilada. Para probarlo en tu computadora, usá un servidor HTTP local; abrir index.html con doble clic no sustituye a GitHub Pages.

## Alcance y fuentes

20 aeropuertos, cuatro modelos de avión, tres rivales simplificados y seis eventos. Una base por aerolínea, vuelos directos y un avión por ruta. Sin multijugador. La economía es simulada; no son cotizaciones ni datos en vivo.

Código nuevo. No incluye la ROM original de Aerobiz, sus gráficos ni su música.

- Airbus: https://www.airbus.com/en/products-services/commercial-aircraft/passenger-aircraft/a320-family
- Embraer: https://www.embraer.com/continent-connectors-fly-e2/en/
- Boeing: https://www.boeing.com/commercial/787
- Cartografía Natural Earth, dominio público: https://www.naturalearthdata.com/about/terms-of-use/
