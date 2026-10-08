# Apex Trail R4 — primer vehículo 3D

Tutorial 1.7.1, versión del 8 de octubre de 2026.

Un único 4×4 original compartido por las seis escuderías. La carrocería utiliza
el color del equipo; neumáticos, cristales, llantas, faros y accesorios conservan
sus materiales. El modelo incluye pasos de rueda, neumáticos con dibujo,
parrilla, defensas, ganchos, espejos, estribos, toma de aire, portaequipaje,
luces de techo, antena y rueda de auxilio trasera.

## Archivo y presupuesto

- `tutorial/assets/vehicles/trail-r4.glb`: 358.184 bytes (350 KiB).
- 4.906 triángulos, seis mallas/materiales, sin texturas ni recursos externos.
- `team_paint` es el único material que cambia de color.
- Ejes: +Y arriba, -Z frente; neumáticos apoyados cerca de Y=0.
- Geometría estática: esta primera versión no anima las ruedas ni la suspensión.
- Generador editable: `scripts/build-rally-vehicle.mjs`. El GLB también se puede
  importar en Blender para futuras revisiones.
- Diseño propio ficticio, sin logos ni modelos de vehículos de terceros.

## Integración

El mapa usa instancias de las seis geometrías, sin crear una copia de cada malla
por escudería. La orientación responde al camino y a la pendiente del terreno.
El visor genérico conserva los vehículos básicos si no se solicita el modelo
nuevo o si el archivo no puede cargarse. Sólo el tutorial activa el Trail R4.

El botón **Ver vehículo** abre una vista cercana giratoria con selector de los
seis colores. Cambiar ese selector es una previsualización: no cambia la
escudería seleccionada ni el estado del entrenamiento. Escape/cerrar libera el
visor y devuelve el foco al botón. También puede abrirse directamente:
http://127.0.0.1:4188/tutorial/vehicle.html

Modelo, visor y vista independiente están incluidos en la caché offline de la
versión 1.7.1. El mapa funciona igual si WebGL falla, con el respaldo plano.
No se modifican Worker, D1, motor de simulación ni partidas. El cambio agrega
descarga de recursos estáticos y trabajo de GPU local, no llamadas API.

## Verificación

- 49 pruebas aprobadas de geometría, GLB, materiales, terreno, tutorial y caché.
- Edge en 1440, 390 y 320 px; revisión visual frontal y lateral del modelo.
- Seis pinturas producen seis imágenes distintas. Se preservan el reloj,
  kilómetros y guardado del intento pausado.
- Giro, abrir/cerrar repetidamente, Escape, retorno de foco y reapertura offline.
- Cero errores JavaScript, cero llamadas API y cero frames adicionales en reposo.
- Mapa con seis equipos: 21 llamadas de dibujo en escritorio, 17 en Auto móvil;
  sólo una más que el visor anterior. 166.348 / 64.476 triángulos totales de escena.
- El móvil es emulado; no se midieron FPS en un teléfono físico.

Evidencia: `qa/rally-vehicle-report.json`, `qa/rally-vehicle-tests.log`,
`qa/rally-vehicle/` y la prueba del tutorial `qa/tutorial-terrain-report.json`.

Para reconstruir: `node scripts/build-rally-vehicle.mjs` y luego
`node scripts/build-tutorial-terrain.mjs`. Para servir localmente:
`node qa/local-preview-server.mjs`. La copia pública se actualiza en
`online/public/tutorial/`. El paquete de esta versión permite actualizar sólo
`tutorial/` sobre el sitio existente. La verificación del despliegue se registra por separado.
