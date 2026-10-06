# Apex1000 Rally · mapas ilustrados de los 32 circuitos

Esta entrega incorpora un fondo propio para cada una de las 8 travesías largas y
las 24 carreras cortas del catálogo. El tutorial conserva su mapa independiente.

Los terrenos son ilustraciones originales generadas con la herramienta integrada
imagegen. Representan artísticamente los paisajes de las regiones: no son imágenes
satelitales reales ni cartografía para navegar. Las ciudades y coordenadas del
juego se conservan; montañas, vegetación, lagos y costas son interpretaciones
comprimidas para el visor. No se modifican distancias, tiempos ni simulación.

## Archivos

- `assets/maps/`: fondos WebP que utiliza el juego, uno por circuito.
- `data/race-maps.js`: asociación de circuito y fondo.
- `docs/mapas/circuitos.json`: composición, localidades y corredores por etapa.
- `docs/mapas/activos.json`: resolución real, tamaño y SHA256 de cada fondo.
- `docs/mapas/prompts/`: prompts exactos de generación y correcciones.
- `docs/mapas/GUIA-ESTETICA-MAPAS.md`: criterios estéticos y técnicos.
- `scripts/build-map-briefs.mjs`: reconstruye las fichas con las coordenadas del
  catálogo y mantiene las versiones de fondos ya producidas. No genera imágenes.

Los PNG maestros se conservan localmente en `entregas/mapas-maestros-v1/` y en la
carpeta original de imagegen. No se publican todos esos maestros para evitar
duplicar el peso de descarga. WebP es una conversión de formato al 90% de calidad:
sin recorte, reescalado ni retoques procedurales.

El mundo del visor mide 1000 × 950 unidades. La imagen ocupa esas coordenadas,
debajo del trazado, campamentos, nombres y escudos. Se carga sólo el fondo activo;
los movimientos y el zoom no solicitan tiles ni nuevos datos al Worker o D1. Si
falla la imagen, se mantiene la base geográfica vectorial y los equipos, con aviso.

La resolución efectiva se registra en `activos.json`; el objetivo de producción
pedido al generador no debe confundirse con su salida real. En zooms extremos
el terreno raster se suaviza, mientras los trazados y escudos siguen siendo SVG.

## Actualización

El incremental online se aplica sobre la versión 1.6.4: copiar su carpeta
`apex1000rally/` sobre la existente. Incluye el cliente compilado y los fondos.
No requiere despliegue del Worker, migraciones de D1, cambios de catálogo ni reset
de las partidas. El cliente compilado cambia su URL por hash para renovar la caché.

La copia beta offline recibe también los fondos y el visor actualizado. No copiar
su `index.html` ni su `src/app.js` sobre el sitio online: la beta conserva los
controles locales y el online mantiene la autenticación y el reloj del servidor.

## Verificación

La suite completa pasó 189 pruebas. Tras las últimas correcciones de terreno y
etiquetas se repitieron las 9 pruebas de mapas y visor, todas correctas. Los 32
fondos se cargaron y revisaron individualmente con sus trazados superpuestos;
se comprobó también pantalla completa, seguimiento de un rival y zoom ×2000 en
una partida beta ficticia. Se conserva la base vectorial dentro del área del
terreno para que el exterior del mapa permanezca uniforme.

Los 32 WebP finales suman 21.761.028 bytes. Se comprueban sus dimensiones reales,
unicidad, formato, ubicación de los trazados y SHA256. El incremental incluye un
atlas visual y se valida por CRC y por los hashes de sus archivos.
