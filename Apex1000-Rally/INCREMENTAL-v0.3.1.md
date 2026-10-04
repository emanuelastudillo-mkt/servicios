# Incremental v0.3.1 — Visor de carrera

Aplicar sobre **Apex1000 Rally v0.3.0**, la entrega anterior. La carpeta local solicitada ya contiene la actualización completa.

1. Exportar la partida desde el juego y conservar una copia del proyecto.
2. Descomprimir el ZIP en la raíz del repositorio `servicios`, manteniendo su carpeta `Apex1000-Rally/`.
3. Agregar o reemplazar los archivos incluidos. Conservar todos los demás; no se requiere borrar nada.
4. Subir los cambios y recargar el juego. Las partidas v0.3.0 siguen siendo compatibles.

El paquete contiene sólo las modificaciones de esta entrega. No reemplaza las planillas, imágenes, configuración de Google Sheets ni workflows de GitHub. `incremental-v0.3.1-manifest.json` incluye hashes de los archivos entregados y de su base para revisar cambios locales antes de sobrescribir.

## Cambios

- Zoom máximo 120×: más de 13 veces el máximo anterior. Deslizador, rueda centrada en el cursor, botones y seguimiento que conserva el aumento elegido.
- Escudos de las escuderías sobre el mapa, con tamaño constante y número de posición.
- Puesto e intervalos en kilómetros al equipo anterior y siguiente; diferencia de tiempo cuando ambos terminaron.
- Alertas rojas pulsantes para averías y sobrecalentamiento crítico, y amarillas para riesgo elevado. Estado y riesgo por pieza; las reservas nunca se marcan con riesgo de avería.
- Curvas, desvíos y detalle de terreno en las 120 etapas. Entre 641 y 1.801 puntos por etapa y movimiento interpolado por distancia sobre el trazado.
- Panel adaptado a móvil y preferencia de movimiento reducido respetada.

## Alcance del trazado y de las estimaciones

Localidades reales, recorrido deportivo ficticio. No se trata de cartografía vial verificada. Los kilómetros de competición se conservan. La alerta de riesgo estima una hora de conducción a condiciones constantes usando el mismo cálculo de averías del motor; cambia con desgaste, calor y exigencia.

## Verificación

44 pruebas automatizadas, incluyendo geometría de las ocho rutas, continuidad en campamentos, zoom, clasificación, intervalos, alertas, partidas anteriores y campeonato completo. Comparación de 30 horas de simulación con v0.3.0: estado idéntico. Prueba en Chrome de zoom 120×, tamaño de escudos, seguimiento, alerta roja y alerta amarilla mediante compra/montaje de un motor usado. Revisión visual en escritorio y móvil. Incremental aplicado sobre una copia de v0.3.0 y comprobado con las mismas pruebas.
