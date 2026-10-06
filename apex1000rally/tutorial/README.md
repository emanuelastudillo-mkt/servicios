# Entrenamiento virtual 1.6.0

Página independiente, sin importar código de autenticación, API, partidas o catálogo.
Acceso: `tutorial/` (también disponible sin iniciar sesión).

Cinco etapas de 5 minutos, preparación de 5 minutos y cuatro asistencias de hasta
2,5 minutos: hasta 40 minutos de simulación, más las pausas para elegir. ×2 y ×10
reducen ese tiempo a 20 y 4 minutos. Ocultar la pestaña pausa automáticamente;
reabrir siempre pausa. No recupera tiempo real transcurrido al cerrar.

Un solo escenario y solución, con pistas y corrección direccional al terminar.
Sin azar: los errores reproducen las mismas consecuencias. El vehículo, piezas,
calibración y plan afectan distancia, consumo, desgaste, energía y averías. No
completar un bloque genera un remolque exclusivamente virtual para continuar
aprendiendo. No da premios ni representa que el online tenga una solución única.

El service worker sólo tiene alcance tutorial/. Cachea los archivos locales y
permite reabrir offline tras la primera carga en un navegador compatible (HTTPS
o localhost). No modifica caches ajenas ni datos de juego. La clave de guardado
es apex1000-virtual-training-v1. Reiniciar sólo sobrescribe este intento local.
Los datos locales no son elegibles para competir ni se transmiten al Worker.

Pruebas: `node --test tests/tutorial.test.mjs` desde la raíz.
Al cambiar engine.js, también versionar su URL y las referencias de caché en
app.js/sw.js para evitar mezclar versiones al volver a abrir offline.
