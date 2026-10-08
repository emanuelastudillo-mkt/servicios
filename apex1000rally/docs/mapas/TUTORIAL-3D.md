# Tutorial con satélite y relieve 3D — 1.7.0

Versión del tutorial preparada para publicación el 8 de octubre de 2026.

## Alcance

El tutorial usa la escena satelital de Salta, elevaciones reales y vehículos 3D.
Conserva los cinco sectores, distancias, pilotos, reglajes, averías, velocidades,
clasificación, guardados y ritmo de simulación anteriores. `tutorial/engine.js`
no se modifica. El recorrido y sus condiciones siguen siendo ficticios.

El visor permite giro, desplazamiento, zoom, pinza, selección y seguimiento de
equipos, selección de sector, calidad, intensidad del relieve y pantalla completa.
El botón Satélite 3D / Mapa plano conserva una preferencia exclusiva del tutorial.
Al quedar pausado no dibuja frames adicionales. Si WebGL falla, recupera el SVG.
El encuadre general calcula los límites del relieve para no recortarlo en móvil.

## Independencia del juego

Todos los archivos de ejecución están dentro de `tutorial/`. El motor gráfico
compartido se compila como una copia local; no importa módulos de API ni del juego.
La integración actualiza `online/public/tutorial/` para su futura publicación.
No sustituye el bundle principal ni publica los mapas de la carrera online.
No cambia Worker, D1, alarmas, comandos ni frecuencia de consultas.

La caché `apex1000-training-1.7.0` guarda el módulo gráfico, el satélite, alturas,
créditos y el respaldo plano. Sólo anuncia uso offline cuando todos están disponibles.
No elimina cachés anteriores ni datos de usuario. Descarga los recursos una vez
para permitir reabrir sin conexión; supone almacenamiento y trabajo gráfico local.

## Validación

- 47 pruebas aprobadas: lógica del tutorial, geometría, posiciones, clasificación,
  campamentos y caché, más integridad del terreno compartido.
- Navegador Edge, 1440, 390 y 320 px: giro, zoom, pinza, seguimiento, campamentos,
  calidad, relieve, pantalla completa, preferencia plana y recuperación sin WebGL.
- Reapertura con red desactivada: tutorial y relieve 3D disponibles.
- El reloj y el avance continúan con los controles existentes; los controles
  gráficos no alteran progreso ni estado guardado de un intento pausado.
- Cero solicitudes API, cero errores JavaScript y cero frames adicionales en reposo.
- Capturas revisadas; la prueba móvil es emulada, no una medición en hardware físico.

Registros: `qa/tutorial-terrain-tests.log` y `qa/tutorial-terrain-report.json`.
Repetir navegador con `node qa/verify-tutorial-terrain.mjs` y servidor local en 4188.
Vista real del tutorial: http://127.0.0.1:4188/tutorial/
El mapa aparece al iniciar la preparación del entrenamiento.

## Compilación y entrega

`node scripts/build-tutorial-terrain.mjs` compila exclusivamente el tutorial y lo
copia a `online/public/tutorial/`. Las dependencias se instalan dentro de `online/`
a partir del lockfile. El build completo del cliente también ejecuta este paso.

El ZIP incremental de tutorial incluye su carpeta pública completa, fuentes
necesarios para reconstruir el visor, pruebas, documentación y manifiesto SHA-256.
Para aplicar sólo el cambio visual en el alojamiento existente, actualizar
únicamente `tutorial/`. No usar el ZIP anterior de la carrera completa para este paso.
Conservar los créditos y licencias; las imágenes son Sentinel 2016–2017 y la
elevación proviene de Mapzen Terrain Tiles. No se requieren claves de mapas.

Destino público: https://emanuelmkt.com.ar/apex1000rally/tutorial/. La verificación del despliegue se registra por separado.
