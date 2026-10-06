# Apex1000 · Guía estética de mapas de carreras

Versión 2 · tutorial 1.6.4 y catálogo completo 1.6.5.

## Dirección visual

Vista satelital **ilustrada**, vertical y ortográfica: un territorio continuo con
relieve, erosión y vegetación reconocibles. Debe recordar una cartografía de
videojuego de rally hecha con pintura digital y relieve sombreado. La referencia
aportada define el acabado y la lectura; no se copian su geografía, rutas, marcas,
rótulos ni marco naranja. El tutorial representa una región ficticia, no un mapa
geográfico ni una imagen satelital real.

El terreno comunica la dificultad antes de leer la ficha: dunas con crestas,
montañas con pasos, roca con estratos y cañones, ripio con abanicos de grava,
asfalto con valles, infraestructura y asentamientos proporcionados.

## Composición y escala

- Norte arriba, cámara completamente vertical, sin horizonte ni perspectiva.
- Terreno hasta los cuatro bordes. Sin marcos, banners ni interfaz en la imagen.
- Diseñar primero la geometría del recorrido; luego el terreno alrededor de ella.
- Mantener corredores transitables: el camino no atraviesa cimas, edificios ni agua
  sin que el circuito describa un paso, puente o vado.
- Las transiciones son geográficas: dunas junto a una cuenca seca, montaña que
  desciende hacia un cañón, llanura que permite un tramo asfaltado. No separar
  superficies mediante rectángulos o manchas de color con límites artificiales.
- Trabajar en un sistema de coordenadas único. En el tutorial: 1200 × 460 unidades.
  Todo punto del fondo y del trazado se expresa también como porcentaje del mapa.
- El fondo actual mide 2020 × 779 px, relación 2,593:1. El visor ocupa 1200/460
  (2,609:1): la adaptación es menor al 1%. En otros mapas mantener la diferencia
  de aspecto por debajo del 1%; nunca estirar un mapa cuadrado para hacerlo ancho.
- Como objetivo de producción, pedir un maestro de 3072 × 1184 o mayor con esa
  proporción. Registrar la resolución realmente obtenida. No inventar detalle
  mediante reescalado ni prometer nitidez del fondo a cualquier zoom.
- El visor permite ×16: a esa escala el fondo raster puede suavizarse; trazado,
  textos, campamentos y vehículos deben seguir siendo vectores nítidos.

## Relieve, luz y material

Luz diurna suave desde el noroeste, sombras cortas hacia el sureste, constantes
entre mapas. Sin nubes, niebla, flares, iluminación nocturna ni sombras dramáticas
que oculten el camino. El relieve se expresa con textura y sombreado, no con
símbolos triangulares. Los picos quedan junto al corredor, no encima del trazado.

Textura con tres escalas: grandes cuencas y cordones; laderas y masas de vegetación;
granos, estratos, crestas y pequeños cauces. Evitar ruido uniforme, texturas que se
repitan como mosaicos y grandes elementos decorativos desproporcionados.

## Paleta y señales por superficie

Los colores orientan, no sustituyen al relieve. Son rangos de dirección artística,
no valores que deban teñir por completo un circuito.

| Entorno | Paleta orientativa | Señales visuales | Evitar |
| --- | --- | --- | --- |
| Ripio | oliva #586146, piedra #a69b79, tierra #77664b | gravas claras, suelo erosionado, arbustos bajos, ramblas secas | arena lisa sin piedra, vegetación tropical genérica |
| Arena | ocre #c59b5b, luz #ddba7c, sombra #8d6538 | crestas sinuosas, dunas alineadas por viento, cuenca seca | montículos aislados de aspecto plástico, naranja neón |
| Montaña | gris #7d8079, roca #65634f, bosque #354d38 | cordones, pasos estrechos, relieve escalonado, vegetación en zonas protegidas | nieve abundante si no la describe la carrera |
| Roca/cañón | arcilla #a56d4c, estrato #79523e, luz #c39770 | paredes estratificadas, gargantas ramificadas, abanicos de erosión | rocas flotantes, polígonos morados |
| Asfalto | oliva #73805a, camino #697169, edificios #beb9a5 | valle abierto, carretera proporcionada, campos y pueblos pequeños | megaciudades, autopistas irreales en entornos rurales |
| Agua, si corresponde | azul verdoso #2c6068, ribera #73918a | cauces acordes al relieve y cruces justificados | lagos sobre pasos de montaña o atravesados sin puente |

En circuitos reales, adaptar vegetación, aridez, nieve y asentamientos a la región
que indique el catálogo. No sumar una selva, glaciar o ciudad porque luzca bien si
no corresponde al país, estación y recorrido. Documentar qué es aproximación
artística y qué proviene de la ficha de la carrera.

## Capas del visor: mantenerlas separadas

1. Fondo local PNG: sólo terreno; sin texto, rutas competitivas, autos ni marcas.
2. Sombreado suave de borde: entre 0 y 18%, sin oscurecer todo el fondo.
3. Rótulos de regiones: nombre principal blanco marfil #f5f0df y superficie debajo.
4. Trazado SVG: halo oscuro de 6 px, identidad de etapa de 3,5 px y eje claro de
   1,4 px. Usar `vector-effect="non-scaling-stroke"` para que el zoom no lo engorde.
5. Largada, campamentos y meta, situados en las coordenadas reales del recorrido.
6. Vehículos y posiciones: color de escudería, contorno, selección y foco de teclado.

Los colores del recorrido del tutorial son ripio #bcb080, arena #e5b86f,
montaña #90c5cd, roca #c2a9d0 y asfalto #c1d2e2. La línea central clara y el halo
conservan legibilidad incluso donde esos colores se aproximan al terreno.

Rótulos: sans serif del sistema, mayúsculas, peso 750, 11 unidades, espaciado 1,3;
subtítulo de superficie de 9 unidades. Contorno oscuro de 3 unidades,
`paint-order: stroke`. Campamentos: 9 unidades y contorno de 4. No quemar textos
en el raster: deben poder corregirse y traducirse sin regenerar el terreno.

La separación lateral de marcadores agrupados es sólo visual; no altera kilómetros
ni clasificación. La llegada se calcula por distancia, nunca por el dibujo ni por
un temporizador de animación. Mantener la corrección de campamentos de 1.6.2.

## Ficha específica del tutorial

| Etapa | Distancia | Corredor aproximado en % del fondo | Interpretación |
| --- | --- | --- | --- |
| Quebrada de entrada | 8 km | x 5–22, y 57–75 | estribaciones de ripio y vegetación seca |
| Dunas del horno | 7 km | x 22–39, y 53–74 | cuenca arenosa caliente; 46 °C en la ficha |
| Paso del Cóndor | 6 km | x 39–58, y 28–59 | paso montañoso rocoso y vegetación protegida |
| Cañón de las agujas | 7 km | x 58–76, y 35–71 | estratos rojizos y gargantas secas |
| Recta del horizonte | 12 km | x 75–95, y 21–62 | valle más abierto, caminos, campos y poblado |

El circuito y los seis equipos siguen siendo ficticios. El terreno no modifica
las reglas, tiempos, condiciones ni la solución del tutorial.

## Procedimiento para producir otro circuito

1. Leer su ficha: país de largada, ciudades, superficies por etapa, kilómetros,
   clima y accidentes geográficos. Separar datos confirmados de interpretación.
2. Preparar `FICHA-MAPA` con dimensiones, corredor por etapa en coordenadas y %,
   ubicación de paradas y proporción de los terrenos. Usar la plantilla adjunta.
3. Fijar la geometría jugable. No moverla después para hacerla encajar en una imagen
   bonita sin actualizar y verificar también las posiciones de la simulación.
4. Generar el terreno con el prompt base y una guía de composición. La referencia
   de estilo no es un mapa de coordenadas. Pedir sólo fondo, sin texto ni trazado.
5. Inspeccionar la imagen completa y a zoom: identificar cada superficie y revisar
   que cada corredor tenga continuidad. Si hay agua, cimas o edificios en ruta,
   corregir la imagen o la geometría antes de publicar, sin disimular el conflicto.
6. Integrar los overlays con el mismo grosor, tipografía, jerarquía y marcadores.
7. Verificar en navegador: vista completa, seguimiento, zoom, pantalla completa,
   paradas exactas, etiquetas, rivales, cambios de etapa y reapertura offline.
8. Guardar imagen, ficha, prompt exacto, versión, dimensiones y hash. Conservar el
   original generado y crear un nombre nuevo si se revisa, por ejemplo `-v2.png`.
9. Publicar el asset y actualizar caché/manifiesto junto a las URLs del cliente.
   El fondo es estático: no debe solicitar tiles ni servicios de mapas al Worker.

## Entrega técnica y criterios de aceptación

- PNG sRGB opaco; fondo de tamaño razonable, objetivo ≤5 MiB por región. El actual
  pesa 3.683.712 bytes. Si se codifica otra versión en WebP, verificar calidad y
  conservar el PNG maestro; documentar la conversión y no sustituirlo sin revisar.
- Asset dentro del proyecto, no enlazado a una carpeta temporal ni a una URL externa.
- En el tutorial, archivo `tutorial/assets/tutorial-terrain-v1.png`; el service
  worker de `tutorial/` lo cachea para funcionar tras la primera carga conectada.
- Al fallar el fondo, mostrar una base simple y aviso; conservar ruta y rivales.
- Ninguna modificación de economía, vehículos, pilotos, RNG o lógica de carreras
  para compensar un problema puramente visual.
- Lectura reconocible de cada terreno sin depender de su etiqueta; rutas y autos
  visibles sobre dunas claras y bosque oscuro; campamentos correctamente ubicados.
- Cero marcas de otros juegos, texto generado defectuoso, grillas llamativas o UI
  incrustada. Sin tiles ni conexiones externas por cada movimiento o zoom.

## Prompt reutilizable

Usar `PLANTILLA-PROMPT-MAPA.txt` sustituyendo todos los campos entre llaves antes
de generar. El prompt exacto aplicado a este tutorial está en
`PROMPT-TUTORIAL-TERRENO.txt`; la ficha implementada en `FICHA-TUTORIAL.json`.
Generación realizada con la herramienta integrada imagegen, usando las imágenes
como referencias visuales. El raster final es original y los overlays se crean en
el código del juego. El catálogo completo cuenta con 32 fondos propios: ocho travesías y 24 sprints.

## Catálogo completo · versión 1.6.5

El visor principal emplea un mundo de 1000 × 950 unidades, con norte arriba.
Los fondos tienen esa misma proporción, con diferencia inferior al 1%. Los
corredores y localidades están documentados en `circuitos.json`; los prompts
exactos, en `prompts/`, y las salidas reales y hashes, en `activos.json`.

Cada carrera dispone de una imagen independiente. La travesía larga de Australia
representa una escala continental; los sprints muestran regiones locales. No
intercambiar esos fondos ni convertir una imagen en un collage de biomas.

Las costas, masas de agua y relieve son interpretación artística comprimida y
pueden apartarse de su posición real para respetar la geometría jugable existente.
Las ciudades, kilómetros y posiciones continúan procediendo del juego. Las
correcciones de costa se guardan en nuevos assets y prompts separados.

El juego usa WebP locales; se conservan los PNG maestros sin retoques. Sólo se
carga el fondo de la carrera activa. Ruta, rótulos y escudos siguen siendo SVG;
el zoom máximo de 2000× no implica detalle raster a esa ampliación. En una carrera
nueva hay que generar y revisar su fondo antes de agregarlo al registro.
