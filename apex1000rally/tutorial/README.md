# Entrenamiento virtual 1.7.1

Primer vehículo detallado: **Apex Trail R4**, una misma geometría con el color de
cada equipo. En el visor, pulsar **Ver vehículo** para girarlo y comparar pinturas.
También está disponible en `vehicle.html`. [Ficha y verificación](../docs/mapas/VEHICULO-TRAIL-R4.md).

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

Visor: imagen satelital y elevaciones reales de Salta, con terreno y vehículos 3D.
Las cinco etapas de ripio, dunas, montaña, roca y asfalto siguen siendo ficticias:
la geografía es el escenario visual, no una medición de los 40 km ni una predicción
de superficies o clima reales. La elevación se amplifica para hacerla legible.
Girá arrastrando, acercá con rueda o pinza y desplazá con dos dedos o botón derecho.
Podés seguir cualquiera de los seis equipos, tocar un campamento, ver todo el
recorrido y cambiar relieve o detalle. El modo Plano conserva el visor ilustrado
anterior con zoom ×1–×16 y se activa automáticamente si falla WebGL.
Ambos muestran posición, piloto, velocidad, avance e intervalos. Cada campamento
se alcanza recorriendo sus kilómetros. Mapa y tabla comparten la clasificación.

El nodo del visor permanece montado aunque cambie la etapa: conserva selección,
cámara y foco de sus controles. Si el navegador rechaza la API de pantalla completa,
se amplía dentro de la ventana; Escape o el botón de salida restablecen la vista.
Three.js, el satélite, las alturas y sus licencias se distribuyen dentro de
`tutorial/assets/terrain3d/`; no hay CDN, tiles en tiempo de juego ni solicitudes
al Worker. El PNG anterior queda como respaldo local. La caché offline incluye
todos esos archivos y sólo confirma disponibilidad cuando está completa.
El detalle se adapta a móvil y el render se detiene cuando no hay cambios.
La preferencia `apex-tutorial-terrain-v1` es independiente de la del juego online.

Pruebas: `node --test --test-isolation=none tests/tutorial.test.mjs tests/tutorial-viewer.test.mjs tests/tutorial-review.test.mjs tests/tutorial-terrain.test.mjs` desde la raíz.
Compilar sólo el tutorial: `node scripts/build-tutorial-terrain.mjs`. Usa las
dependencias fijadas en `online/pnpm-lock.yaml`; también copia a `online/public/tutorial/`.
La compilación completa del cliente incorpora este paso automáticamente.
Al cambiar engine.js, también versionar su URL y las referencias de caché en
app.js/sw.js para evitar mezclar versiones al volver a abrir offline.

Guardados: versión interna 2. Los intentos anteriores con etapas incompletas que
ya habían cambiado de campamento se reinician conservando la configuración y
respaldando el original en apex1000-virtual-training-v1-legacy-v1. Los intentos
anteriores coherentes se conservan pausados. No se toca la escudería online.

El modo Plano conserva la dirección visual de `../docs/mapas/GUIA-ESTETICA-MAPAS.md`.
La vista 3D transforma los mismos puntos del recorrido al escenario satelital y
ubica autos y camino sobre la misma malla de elevación. No cambia engine.js ni
los intentos guardados. Créditos en el panel «Datos del mapa» y en los archivos
de atribución del propio tutorial.

## Revisión 3D 1.7.0

Versión del tutorial preparada para publicación. Informe: `../docs/mapas/TUTORIAL-3D.md`.
La suite del tutorial, la comprobación de geometría, las pruebas de navegador
y la reapertura offline se verifican sin conectar la API del juego.

## Revisión funcional 1.6.4

Ver [informe de correcciones y pruebas](../docs/REVISION-TUTORIAL-1.6.4.md).
Guardados validados con respaldo, pausa coherente, asistencia parcial precisa,
mapa móvil sin recortes y caché offline comprobada por versión.
