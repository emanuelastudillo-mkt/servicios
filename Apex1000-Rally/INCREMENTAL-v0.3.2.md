# Incremental v0.3.2 — Admin y bitácora

Aplicar sobre **Apex1000 Rally v0.3.1**. Esta es la entrega del avance implementado, solicitada antes de definir las nuevas reglas de competición.

## Instalar

1. Exportar la partida desde el juego y conservar una copia del proyecto.
2. Descomprimir el ZIP en la raíz del repositorio `servicios`, manteniendo su carpeta `Apex1000-Rally/`. Si se copian los archivos manualmente, poner el contenido de esa carpeta dentro de la carpeta existente del juego, sin duplicar el nivel.
3. Agregar o reemplazar solamente los archivos incluidos. Conservar todos los demás; no hay archivos para borrar.
4. Subir los cambios y recargar el navegador con Ctrl+F5.

El juego permanece estático, compatible con GitHub Pages. Se incluye la fuente manuscrita local y su licencia, sin depender de un servicio de fuentes externo. El manifiesto del ZIP incluye SHA-256 de cada archivo y de su versión base para revisar cambios propios antes de reemplazarlos. La carpeta local de trabajo ya está actualizada.

## Incluido

- Barra Admin independiente: pausa, 1×, 60×, 600×, 3600×, ir a la largada, +1 hora, +24 horas, próxima parada y próxima carrera.
- Controles de tiempo retirados de la cabecera, mapa y apartado Campeonato. La barra funciona también sobre el mapa a pantalla completa y ajusta su altura en móvil.
- `ADMIN_ENABLED` en `src/admin-ui.js` permite ocultar la barra completa y bloquear sus controles. Al desactivarlo, el reloj funciona a 1×. El backend online sigue pendiente.
- Bitácora tipo papel con letra manuscrita: una o dos notas por etapa sobre hechos observados y consejos relacionados con las reglas de simulación.
- Observación de calor que realmente redujo velocidad, fatiga, averías, rescates por combustible, configuraciones desfavorables, errores y etapas limpias.
- Notas persistentes durante la carrera, validación de partidas importadas y compatibilidad con guardados anteriores. Las etapas anteriores a la actualización no se reconstruyen; una etapa ya empezada sólo registra lo observado desde la actualización.
- Corrección del nombre de la localidad en el aviso de llegada final de cada ruta.

## Pendiente de la siguiente entrega

El campeonato y los puntos actuales siguen funcionando. Aún no se implementaron su reemplazo por carreras independientes, inscripción por carrera, cierre 24 horas después del primero, cuenta regresiva hacia la siguiente carrera, nivel con curva creciente y decaimiento, logros e hitos. Las decisiones sobre inscripción tardía, inactividad y premio de quienes no terminen continúan pendientes de respuesta.

“Próxima carrera” conserva la condición actual: todos los equipos deben terminar y debe quedar una carrera de las ocho. Mientras tanto se puede avanzar el reloj desde Admin. Los cambios de Google Sheets y la conexión remota no forman parte de este ZIP.

## Verificado

- 49 pruebas automatizadas, incluidas cinco de notas, migración, importación y escape de textos.
- Paquete aplicado a una copia de v0.3.1: hashes coincidentes, archivos anteriores conservados y 49 pruebas aprobadas sobre esa copia.
- Comparación de 30 horas de simulación con v0.3.1: mismas posiciones, economía, mecánica y estado aleatorio, excluyendo sólo los nuevos campos de bitácora.
- Revisión en Chrome de escritorio y móvil de 390 × 844: sin desborde horizontal, notas de dos etapas verificadas, menú separado y mapa de pantalla completa sin superposición con Admin. Sin errores de consola durante esa revisión.
