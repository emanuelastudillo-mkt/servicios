# Revisión del tutorial · 1.6.4

## Problemas corregidos

- **Guardados incompletos:** se comprueban combustible, planes, borradores,
  instantáneas de estado y energía, historial, resultado y coherencia de fase.
  Un guardado inválido ya no puede romper el render ni dejar el reloj detenido.
  Se conserva su original con una clave local `-recovery-<fecha>` antes de abrir
  otro intento. Si el navegador no permite ese respaldo, no se sobrescribe.
  Un borrador inválido se descarta conservando el intento válido.
- **Pausa:** el tablero ahora marca 0 km/h y ralentí, igual que el mapa.
  Al continuar recupera su velocidad y distancia sin consumir tiempo en pausa.
- **Asistencia parcial:** reloj y checklist comparten las mismas tareas.
  Reparar sólo averías indica cuántas piezas se trabajan; si ninguna está rota,
  no inventa dos minutos de reparación. El descanso parcial muestra progreso y
  finalización, en lugar de figurar como omitido. Se respetan los tiempos de una
  asistencia guardada en la versión anterior para poder retomarla.
- **Combustible en campamento:** se parte de los litros restantes; ya no se
  vacía visualmente el tanque al comenzar la carga.
- **Aviso de avería:** no tener al especialista activo en el tramo crítico
  produce una alerta previa de riesgo alto, antes del fallo guionado.
- **Ubicación de rivales:** un auto aislado queda sobre el trazado. Sólo se
  separan iconos que se superponen; una línea y un punto indican la posición
  exacta de cada uno. Sus kilómetros y clasificación no dependen del icono.
- **Móvil:** el mapa respeta el ancho disponible y evita el recorte provocado
  por la combinación de altura mínima y proporción del contenedor.
  La pantalla ampliada en móvil utiliza un panel propio y mantiene sus controles.
- **Offline:** recursos cacheados se sirven localmente; navegar busca una
  actualización y recurre a la caché ante desconexión o error HTTP. El aviso
  de disponibilidad sólo se emite si están todos los archivos de la versión.
  Se contempla la activación de un service worker nuevo y el favicon compartido.
  Si se perdió un recurso cacheado, una carga conectada vuelve a guardarlo.
- **Informe:** el botón del visor al terminar se llama «Ver informe».

## Alcance y reglas conservadas

Cinco etapas, 40 km, límite de 40 minutos simulados, velocidades ×1/×2/×10,
decisiones pausadas en campamento y una única solución correcta. La llegada
depende de los kilómetros recorridos. No se habilita asistencia en ruta.
Los intentos son locales, ficticios y separados de la escudería online.
No hay cambios de API, Worker, D1, economía ni catálogos de la competición.

## Verificación

- Suite general: 185 pruebas aprobadas durante la revisión.
- Suite final del tutorial: 41 pruebas aprobadas, incluyendo un recorrido entero
  guardado y reabierto repetidamente con intervalos de reloj fraccionarios.
- Cobertura de alternativas de reglajes, vehículos, piezas, pilotos, ritmo,
  combustible y asistencia; parada exacta, averías, falta de combustible y límite.
- Casos de guardados inválidos, borrador dañado, asistencia heredada, pausa,
  carga de combustible, superposición de marcadores, caché incompleta y errores HTTP.
- Compilación del cliente online aprobada.
- Chrome: recorrido completo a ×10 con resultado ganador a 40:00 y 40 km;
  llegada a los cuatro campamentos, pausa, recarga, cambio de piloto, tareas,
  selección persistente de rival y reintento conservando los seis reglajes.
- Caso deliberado de fallo: aviso amarillo, avería roja a 30 km/h, abandono a
  5,15 km y plan de etapa bloqueado. Mapa e informe coinciden en P6 y distancia.
- Guardado incompleto: nuevo intento y respaldo original comprobado mediante
  un panel local de QA. Asistencia parcial: regreso automático tras 75 s.
- Pantalla de 390 × 844: configuración, mapa de 297 px dentro del panel de 327 px
  y modo ampliado de 362 px. Sin recorte horizontal del mapa.
- Servidor apagado: reapertura del resultado, fondo ilustrado y seis rivales.

## Instalación

Aplicar el incremental sobre la interfaz 1.6.3. No necesita desplegar el Worker
ni ejecutar migraciones D1. Abrir una vez conectado para descargar la nueva
caché; después puede reabrirse sin conexión. No abrir mediante `file://`.
