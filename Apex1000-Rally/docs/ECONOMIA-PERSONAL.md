# Economía y personal · v0.4.2

Finanzas y Equipo usan paneles oscuros, un desglose de gastos, un gráfico real de saldo, fichas de contrato, atributos y medidores de moral inspirados en las referencias del usuario. Conservan los escudos y la identidad Apex1000.

## Fecha y nómina

La fecha visible procede de `startAt + clock`, con hora de Argentina (ART, UTC−3). Admin permite adelantar al siguiente cobro y pausa al llegar. El modo online futuro deberá usar la fecha real del servidor y retirar todos los controles Admin; no está desplegado en esta entrega.

Se liquidan **sueldos y gastos fijos el primer día de cada mes a las 00:00 ART**, también sin participar en carreras. Los meses tienen su duración real (incluidos años bisiestos). Desaparece el cobro por largada y la reducción de sueldo al 20% en sprints. Compras, mejoras, reparaciones y combustible siguen pagándose al realizarlos.

La nómina se devenga proporcionalmente al tiempo contratado del mes. Una alta a mitad de mes paga su fracción el siguiente día 1. El costo fijo `Ajustes.monthlyBaseCost` es 1.500 créditos por mes completo, editable. Saldo insuficiente: se paga lo disponible y el resto pasa a deuda; se descuenta de los premios posteriores. La liquidación identifica devengado, pagado e impago. Las reservas de ofertas se devuelven al adjudicar, perder o cancelar; no hay prima de firma ni doble sueldo.

## Contratos y renovación

Duración inicial: **12 meses calendario**. Se puede renovar en cualquier momento mientras siga contratado, agregando otros 12 meses al vencimiento existente. La solicitud compara el nivel actual de la escudería con el nivel de la última firma o renovación:

| Cambio de nivel | Cambio solicitado |
| --------------- | ----------------: |
| Subió 2 o más   |              +20% |
| Subió 1         |              +10% |
| Se mantuvo      |               +3% |
| Bajó 1 o más    |              −20% |

Se tomó +20% para exactamente dos niveles, caso que no estaba especificado. La ficha muestra el nivel de referencia, variación y propuesta antes de aceptar. Cada renovación actualiza ese nivel de referencia. El sueldo actual se liquida en el siguiente cobro; a partir de ese momento comienza el nuevo sueldo y su devengamiento.

Sin renovar, la persona vuelve al mercado y libera la titularidad exclusiva. Si vence durante una carrera, continúa hasta el cierre oficial de esa prueba, conservando la clasificación y pudiendo renovar durante la prórroga. Se anulan inscripciones futuras que dependían del piloto vencido. Sin pilotos o asistencia, el equipo permanece en la base hasta contratar personal; no se entrega un reemplazo gratuito. Los rivales simulados renuevan automáticamente sus contratos para mantener la parrilla.

## Edad, forma, moral y especialidades

Las fichas y los mercados muestran edad en años y forma/moral de 0 a 100. Son personajes ficticios. La edad aumenta al cumplir años. La forma baja 0,1 puntos/hora conduciendo y recupera 0,03 puntos/hora en reposo; es independiente de la energía. Menor forma aumenta cansancio y reduce ritmo. La moral sube 2 puntos con un cobro al día y 3 al renovar; baja 8 con una liquidación impaga. Forma y moral afectan la eficiencia de los mecánicos en ambas asignaciones y el rendimiento del piloto. Los valores se limitan a 0–100.

Especialidades configurables en `Pilotos.traits` y `Mecanicos.traits`, separadas por `|` sin espacios:

- `terrain:gravel`, `asphalt`, `mountain`, `sand` o `rock`, cada uno con prefijo `terrain:`: +6% de ritmo y −15% de riesgo **sólo en ese terreno**.
- `car:hilux`, `raptor`, `sandrider`, `mini`, `niva`, `hunter` o `audi`, cada uno con prefijo `car:`: +4% de ritmo y −10% de riesgo **sólo con ese modelo**.
- `part:engine`, `transmission`, `suspension`, `tyres`, `cooling` o `brakes`, cada uno con prefijo `part:`: evita las averías aleatorias **sólo de esa pieza**. El experto en refrigeración también baja 8 °C la temperatura objetivo.

Ejemplo válido: `terrain:gravel|car:hilux`. El piloto debe estar conduciendo; el mecánico debe estar asignado a carrera. Un relevo o un mecánico en la base no protege el auto que está corriendo. La protección no repara una avería previa ni elimina desgaste, calentamiento, pérdidas de rendimiento o daños por accidentes. El tablero usa la misma protección para estimar el riesgo. Bonificaciones iguales no se acumulan por contratar varias personas con el mismo rasgo; superficie y modelo pueden combinarse. Sigue vigente el máximo de velocidad del terreno.

## Compatibilidad y catálogos

Las partidas anteriores conservan saldo, daños, inventario, trabajo, ofertas y catálogo. Reciben contratos de 12 meses desde **su fecha guardada actual**, sin cobrar el pasado. Los movimientos viejos sin fecha absoluta figuran como históricos en el acumulado; no se les inventa un mes. Los movimientos nuevos tienen fecha absoluta, por lo que cambiar de carrera no cambia sus fechas.

La planilla existente añade `age`, `form`, `morale`, `traits` a Pilotos y Mecánicos, y `monthlyBaseCost` a Ajustes. El importador valida esos valores antes de publicar JSON/JS. La actualización diaria continúa por el workflow existente. **Los cambios de planilla se aplican a partidas nuevas**; una partida iniciada conserva los contratos y valores de su propio catálogo. Aplicar primero este incremental en GitHub: el importador anterior no admitía el quinto ajuste.

## Preparación online

`employment.js` usa el reloj de la partida, sin DOM ni reloj del equipo del jugador. `dispatch` incorpora `renew-contract`; el snapshot público añade `gameAt` y no publica nómina o contratos privados. El servidor deberá serializar ofertas, vencimientos y renovaciones, mantener una titularidad global por persona, y liquidar con una clave única `(team_id, calendar_month)` para que reintentos no dupliquen cobros. El registro de caja, la deuda y el cambio de sueldo deben persistirse en la misma transacción. Las prórrogas se resuelven al cerrar la carrera.
