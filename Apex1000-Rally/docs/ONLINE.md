# Próxima etapa: carrera online con reloj compartido

Este documento describe la migración. Los endpoints, tablas y servicios que siguen **no están desplegados ni implementados**. El contrato público y el motor local sí funcionan en el prototipo.

## Semántica de carrera

- `starts_at` es una sola fecha UTC elegida por el organizador. No hay salida independiente por jugador.
- La inscripción cierra antes de la largada. El primer plan se entrega dentro de ese plazo; quien no lo entregue espera desde la largada hasta que confirme uno.
- Cada participante tiene su propia etapa, distancia, energía, servicio y próxima salida. El servidor conserva el mismo tiempo global para todos, sin bloquear a los adelantados esperando al resto.
- El ganador es quien cruza la meta antes. El tiempo final incluye conducción, incidentes, espera de órdenes, asistencia y descanso.
- Un plan futuro se puede reemplazar hasta que comience su asistencia. La transición y el cierre deben ocurrir en la misma transacción que toma el plan; el cliente no decide cuál llegó primero.
- Descanso y trabajo se superponen; la duración de la parada es `max(trabajo_mecánico + carga, descanso_limitado_a_100%)`.
- No habrá pausa, salto de etapa ni aceleración accesible al jugador online. Cerrar el navegador no detiene al equipo.

## Separación recomendada

1. **Cliente estático**: el visor conserva `visuals.js`, roadbook, formularios y estimaciones informativas. Recibe posiciones y envía intenciones.
2. **API autenticada**: acepta planes y compras. Obtiene el jugador de la sesión, nunca de un `playerId` confiado al navegador. Aplica catálogo de precios del servidor.
3. **Simulador autoritativo**: ejecuta ticks de 30 s, conserva RNG privado por participante y actualiza progreso, consumo, piezas, fatiga e incidentes. Debe reutilizar las funciones del motor, extrayendo una entrada de avance exclusiva de servidor; no cambiar simplemente `mode` desde el cliente.
4. **Persistencia**: almacena checkpoints, órdenes, piezas y movimientos con revisión/idempotencia. `schema.sql` propone relaciones base.
5. **Publicador**: emite posiciones resumidas y eventos públicos por polling inicial de 5–15 s. SSE/WebSocket puede añadirse después.

Para una primera implementación, un Worker/API y una base SQL son suficientes para explorar el flujo. La elección entre Workers + D1 + Durable Objects u otro backend depende del tamaño de parrilla y las mediciones de CPU/escrituras. No asumir que una llamada programada se dispara en el segundo exacto: cada ejecución debe recuperar ticks faltantes desde `last_tick`.

## Orden y consistencia

Usar un solo coordinador por carrera o un bloqueo con vencimiento y compare-and-swap por revisión. Un tick debe persistir de manera atómica la nueva posición, RNG, desgaste, combustible, eventos y checkpoint. Una reejecución no puede cobrar dos veces ni avanzar dos veces el mismo intervalo.

Si se procesan participantes en paralelo, no pagar premios de posición hasta que **todos** hayan sido procesados hasta el instante del finisher. Si no, un participante cuya simulación se retrase podría aparecer como segundo aunque llegó antes. El motor local ya avanza a todos dentro del mismo tick y ordena las llegadas exactas dentro de él.

Conservar un `engine_version` y `route_version` inmutables por carrera. Un cambio de balance se aplica a la carrera siguiente. Probar checkpoints restaurados contra una ejecución continua con la misma semilla. Un fallo del proceso no debe cambiar el azar ni los gastos.

## Tablas propuestas

| Tabla               | Contenido                                                          |
| ------------------- | ------------------------------------------------------------------ |
| `users`             | Identidad autenticada                                              |
| `races`             | Largada UTC, versiones, estado y tick global persistido            |
| `entries`           | Inscripción, presupuesto, deuda y tiempo final                     |
| `stage_plans`       | Orden versionada por participante y etapa; fecha de cierre         |
| `part_instances`    | Piezas únicas con calidad, estado y ubicación instalada/inventario |
| `driver_states`     | Energía y perfil de cada piloto                                    |
| `entry_checkpoints` | Estado completo privado para recuperar la simulación               |
| `public_positions`  | Proyección de lectura para el visor                                |
| `ledger`            | Débitos y premios con clave idempotente                            |
| `race_events`       | Incidentes y cambios de fase auditables                            |
| `command_receipts`  | Resultado de cada comando, seguro ante reintentos                  |

Los presupuestos se guardan en centavos enteros en SQL. Las distancias y velocidades conservan decimales. Mantener exactamente una reserva por tipo y una pieza instalada por ranura; un intercambio mueve ambas ubicaciones dentro de una transacción. El cliente no puede crear piezas ni elegir su estado después de comprar.

## Contrato del visor ya disponible

`publicSnapshot(state)` devuelve:

```json
{
  "raceId": "andes-…",
  "engineVersion": "rally-1",
  "startAt": "2026-10-10T12:00:00.000Z",
  "elapsedSeconds": 3600,
  "routeKm": 10240,
  "entries": [
    {
      "entryId": "player",
      "name": "Equipo",
      "vehicleId": "hilux",
      "rank": 1,
      "phase": "racing",
      "stageIndex": 0,
      "totalKm": 140.2,
      "stageKm": 140.2,
      "speedKmh": 138.4,
      "finishTime": null,
      "position": { "lon": -58.1, "lat": -35.6 },
      "updatedAt": "2026-10-10T13:00:00.000Z"
    }
  ]
}
```

Ejemplo ilustrativo; consultar la función para los valores exactos y campos auxiliares de `position`. `stageIndex` empieza en cero; al finalizar vale 15. Los participantes activos se ordenan por kilómetros; quienes llegaron se ordenan por tiempo final. `speedKmh` vale cero durante las paradas.

El visor puede interpolar entre dos snapshots para suavizar movimiento, limitando la extrapolación a un intervalo corto y deteniéndola en el final de etapa. No debe generar incidentes ni convertir esa interpolación en posición autoritativa. Mostrar fecha de última actualización y reconectar conservando la selección y el zoom.

## API propuesta

| Método y ruta                      | Resultado                                                           |
| ---------------------------------- | ------------------------------------------------------------------- |
| `GET /races/:id`                   | Largada, ruta, reglamento y versión                                 |
| `GET /races/:id/positions`         | Snapshot público anterior                                           |
| `GET /races/:id/me`                | Estado privado del equipo autenticado                               |
| `PUT /races/:id/me/plans/:stage`   | Guardar plan con `expectedRevision` e `Idempotency-Key`             |
| `POST /races/:id/me/purchases`     | Comprar oferta del catálogo vigente, sin precio enviado por cliente |
| `GET /races/:id/me/events?after=…` | Eventos incrementales privados                                      |

Las rutas de escritura verifican propiedad, fase, revisión, dinero, capacidad y pertenencia de los repuestos. Responder 409 cuando la etapa ya se cerró o cambió la revisión. La misma clave idempotente debe devolver el mismo resultado; no repetir el cargo. Los planes pueden señalar piezas que seguirán instaladas en la etapa siguiente: resolver su ubicación al ejecutarlos.

No exponer semilla, RNG, checkpoints, planes futuros, inventario o presupuesto de rivales en el endpoint público. No aceptar importaciones JSON del prototipo como estados de una competición.

## Lo que falta antes de competir

Autenticación, API, persistencia real, coordinador de ticks, pruebas transaccionales, recuperación ante fallos, reconciliación del cliente, carga concurrente y balance competitivo. Revisar la política de deuda de asistencia, premios, inscripción, abandono, desempates exactos y desconexiones largas. El esquema es un punto de partida y no una garantía de seguridad o escalabilidad de un servicio aún inexistente.

## Extensión de garaje y taller (formato 3, motor rally-3)

El prototipo agrega instancias de vehículo `garage[]` (id, modelId, condition, performance, reliability, odometer), `activeCarId`, destino `assignment` de cada mecánico y `original` de cada pieza. `workshop` contiene secuencias de IDs, cola `jobs[]` y últimos 60 trabajos completados. Cada trabajo guarda objetivo, tipo, valor a alcanzar, costo, horas base y horas trabajadas. La cola se calcula con el reloj del motor, también mientras el equipo está en otra etapa.

Para el servidor futuro, crear tablas de unidades del equipo, trabajos y asignaciones de personal, además de ampliar las piezas. Comprar/vender/canjear, reservar/cancelar trabajos, montar piezas y reasignar mecánicos deben ser transacciones que validen propiedad, capacidad, dinero, stock, fase y revisión. No aceptar costos, progreso o mejoras decididos por el navegador; recalcular el presupuesto usando el catálogo y el estado autoritativos. Impedir que una pieza esté en un plan de montaje y en reparación a la vez. Mantener IDs estables e idempotencia en cobros y devoluciones.

Las funciones puras están en `src/workshop.js` y `src/part-maintenance.js`; la validación de importaciones del prototipo está en `src/workshop-validation.js`. Los indicadores públicos de estado del vehículo se pueden añadir al snapshot; la cola, caja, inventario y planes quedan privados. La Home se deriva de esos datos, sin ser autoridad para acreditar hitos ni dinero.

Esta extensión documenta el contrato necesario; no instala esas tablas, autenticación ni un servicio online. Las banderas de compatibilidad para cuatro autos antiguos o cero mecánicos pertenecen a la migración single player y no deben habilitar excepciones competitivas en estados nuevos del servidor.
