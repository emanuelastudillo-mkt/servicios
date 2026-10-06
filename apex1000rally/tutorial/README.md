# Entrenamiento virtual 1.6.4

Página independiente, sin importar código de autenticación, API, partidas o catálogo.
Acceso: `tutorial/` (también disponible sin iniciar sesión).

Cinco etapas de distancia fija (5 minutos al ritmo ideal), preparación de 5 minutos y cuatro asistencias de hasta
2,5 minutos: hasta 40 minutos de simulación, más las pausas para elegir. ×2 y ×10
reducen ese tiempo a 20 y 4 minutos. Ocultar la pestaña pausa automáticamente;
reabrir siempre pausa. No recupera tiempo real transcurrido al cerrar.

Un solo escenario y solución, con pistas y corrección direccional al terminar.
Sin azar: los errores reproducen las mismas consecuencias. El vehículo, piezas,
calibración y plan afectan distancia, consumo, desgaste, energía y averías. Sólo llegar al final del tramo permite cambiar etapa y configurar el plan siguiente.
Una menor velocidad alarga el tramo: sin combustible o al agotar 40 minutos,
termina el intento con la distancia real y el informe de fallos, sin remolques. No da premios ni representa que el online tenga una solución única.

El service worker sólo tiene alcance tutorial/. Cachea los archivos locales y
permite reabrir offline tras la primera carga en un navegador compatible (HTTPS
o localhost). No modifica caches ajenas ni datos de juego. La clave de guardado
es apex1000-virtual-training-v1. Reiniciar sólo sobrescribe este intento local.
Los datos locales no son elegibles para competir ni se transmiten al Worker.

Visor: mapa satelital ilustrado de ripio, dunas, montaña, roca y asfalto. Sigue a cualquiera
de los seis equipos con zoom ×1–×16, arrastre, pantalla completa y controles de
simulación. Muestra posición, piloto, velocidad, avance e intervalos con anterior
y siguiente. Representa los kilómetros válidos del tutorial; cada campamento se alcanza recorriendo sus kilómetros. Mapa y tabla comparten una única función de clasificación.

El nodo del visor permanece montado aunque cambie la etapa: conserva selección,
cámara y foco de sus controles. Si el navegador rechaza la API de pantalla completa,
se amplía dentro de la ventana; Escape o el botón de salida restablecen la vista.
El fondo es un PNG local cacheado. No necesita tiles, bibliotecas externas ni solicitudes al Worker.

Pruebas: `node --test tests/tutorial.test.mjs tests/tutorial-viewer.test.mjs` desde la raíz.
Al cambiar engine.js, también versionar su URL y las referencias de caché en
app.js/sw.js para evitar mezclar versiones al volver a abrir offline.

Guardados: versión interna 2. Los intentos anteriores con etapas incompletas que
ya habían cambiado de campamento se reinician conservando la configuración y
respaldando el original en apex1000-virtual-training-v1-legacy-v1. Los intentos
anteriores coherentes se conservan pausados. No se toca la escudería online.

Dirección visual implementada: `../docs/mapas/GUIA-ESTETICA-MAPAS.md`, con plantilla
reutilizable, ficha de coordenadas y prompt exacto. El raster sólo dibuja terreno;
las rutas siguen en SVG con grosor constante en pantalla y la geometría no cambia.

## Revisión funcional 1.6.4

Ver [informe de correcciones y pruebas](../docs/REVISION-TUTORIAL-1.6.4.md).
Guardados validados con respaldo, pausa coherente, asistencia parcial precisa,
mapa móvil sin recortes y caché offline comprobada por versión.
