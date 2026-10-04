# Incremental v0.3.5 — Tablero e información de paradas

Requiere v0.3.4. Extraer en la raíz de `servicios`, conservando `Apex1000-Rally/`, y agregar/reemplazar los archivos incluidos. No borrar los demás. Recargar con Ctrl+F5 después de publicar.

## Tablero

- Dos esferas con agujas, escala de 0–280 km/h y de 0–8.000 RPM, biseles metálicos y lectura digital.
- La velocidad y su aguja toman `team.speed` de la simulación; el número muestra un decimal. El combustible, temperatura y recorrido también usan el estado del vehículo seleccionado.
- RPM y marcha visual arcade, con oscilación suave y cambios de rango según velocidad. No consumen combustible ni alteran física, números aleatorios o tiempos de carrera. En campamento, antes de largar, al finalizar y durante una detención de asistencia, las RPM quedan en cero. Pausar el prototipo congela la oscilación.
- Nueve testigos: motor, caja, suspensión, neumáticos, refrigeración, frenos, temperatura, combustible y fatiga. Gris sin advertencias, amarillo para precaución y rojo pulsante ante condición crítica. Los testigos de piezas usan las mismas alertas que el motor de juego; combustible y fatiga tienen umbrales propios explícitos en el código.
- Visible en pantalla completa y en el panel del equipo seleccionado. Se conservan el zoom 2000×, seguimiento de rivales, selector estable y Admin.

## Paradas

El cronograma registra sólo trabajos previstos y financiados al comenzar la asistencia. Las reparaciones y montajes se distribuyen en secuencia usando la tasa real de los mecánicos; el descanso corre en paralelo. Se muestran las tareas omitidas por falta de presupuesto, las reservas de emergencia, el combustible y sus cuatro horas de asistencia cuando corresponden.

Cada tarea indica estado y progreso, y la parada muestra el tiempo restante y una recomendación relacionada con su principal demora. La salida usa el mismo `service.until` que gobierna la simulación, con una resolución de 30 segundos. Se retoma la marcha automáticamente al completar ese plazo si el reloj está activo. Sin plan, sin salida automática o con un auto bloqueado en la base, el panel explica por qué está esperando.

Los cobros y efectos de piezas/combustible siguen aplicándose al comenzar el servicio, como en v0.3.4; el checklist representa el tiempo de trabajo que falta para autorizar la salida. No modifica costos, duración de las paradas ni las reglas de descanso. Una parada de un guardado antiguo sin cronograma conserva su horario y muestra “Asistencia y descanso”, sin inventar trabajos individuales.

## Validación

73 pruebas automáticas con catálogo diario: instrumentos sin efectos sobre la simulación, escalas, testigos, escape de textos, trabajo secuencial y descanso paralelo, salida automática, falta de fondos, reservas, guardado, compatibilidad y rechazo de cronogramas corruptos, además de la batería previa. Revisión en Chrome de agujas, seguimiento y checklist de una parada.

El ZIP incluye archivos de código, estilos, pruebas, documentación y un manifiesto con hashes. No cambia las planillas ni los workflows. Las reglas de competición pendientes de v0.3.3 siguen pendientes.
