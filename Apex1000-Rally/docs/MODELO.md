# Modelo estratégico v0.3.3

El motor ejecuta pasos de 30 segundos y mantiene un generador xorshift32 privado por equipo. Con la misma semilla, planes y compras en los mismos ticks, el resultado no depende del tamaño de las llamadas de avance. La semilla del escenario puede cambiarse al inscribir una nueva carrera.

## Rendimiento

Cada pieza aporta `calidad.rendimiento × (0,55 + 0,45 × estado/100)`. Se combinan con una media geométrica ponderada: motor 31%, transmisión 16%, suspensión 19%, neumáticos 19%, frenos 9%, refrigeración 6%. La técnica añade un multiplicador al rendimiento de piezas.

La velocidad resulta de la base del terreno, vehículo, afinidad de superficie, efecto de piezas, configuración, altura, energía, peso de combustible, exigencia, ritmo y piloto. Se limita al máximo del terreno. Por encima de 112 °C empieza la pérdida de rendimiento y por encima de 122 °C aumenta. Con al menos una pieza averiada, la marcha de emergencia es de 30 km/h. Durante una detención, naturalmente, es cero.

| Superficie | Base km/h | Máximo km/h | Desgaste relativo |
| ---------- | --------: | ----------: | ----------------: |
| Asfalto    |       180 |         250 |              0,70 |
| Ripio      |       115 |         165 |              1,05 |
| Arena      |        82 |         130 |              1,22 |
| Piedra     |        58 |          95 |              1,60 |
| Montaña    |        76 |         120 |              1,25 |

Suspensión baja, presión alta y relación larga favorecen asfalto. Altura alta, presión baja y relación corta favorecen dunas. Presión baja en asfalto desgasta más las gomas. Montaña exige más frenos; piedra y montaña más suspensión. Abrir refrigeración baja temperatura, sacrificando algo de velocidad. El exceso de combustible lleva una penalización de masa y consumo.

## Desgaste e incidentes

El desgaste se calcula por distancia, base del componente, terreno, ritmo, exigencia, habilidad del piloto, confiabilidad del vehículo, resistencia de calidad y temperatura. Bajar a cero de estado reduce rendimiento, pero sólo una avería activa el modo de 30 km/h. Las reservas no pueden averiarse incluso con estado cero.

Cada pieza tiene una probabilidad de avería por hora, multiplicada por desgaste, exigencia y sobretemperatura. Se convierte al intervalo simulado y se compara con el RNG. Es una probabilidad de diseño por intervalo pequeño, no una curva de supervivencia validada. Los errores dependen de terreno, ritmo, exigencia, habilidad y cansancio: navegación agrega demora; una salida de pista agrega demora y daño a una pieza.

La temperatura se aproxima progresivamente a un objetivo que depende del ambiente, arena, exigencia, ritmo, refrigeración, estado y calidad del circuito de refrigeración y tendencia térmica de las seis piezas. El motor pesa 50% de esa carga, transmisión y refrigeración 15% cada una, frenos 10%, neumáticos 6% y suspensión 4%. Un sistema de refrigeración Endurance evacua calor con mayor eficiencia; Factory prioriza rendimiento mecánico. No hay simulación de temperatura separada para cada componente.

## Pilotos

El piloto activo consume una base de 11 puntos de energía/hora, ajustada por perfil y esfuerzo de terreno. Los otros recuperan energía. Todos recuperan durante paradas. La energía está limitada entre 0 y 100; a cero se puede seguir corriendo con peor rendimiento y más riesgo. Rotar piloto permite reducir descanso sin recargar instantáneamente al conductor cansado.

## Presupuesto y taller

Los precios usados dependen de calidad y condición. Una compra agrega una instancia de pieza única; no modifica el vehículo hasta el montaje. Cambiar cuesta 80 créditos y tiempo de trabajo; devuelve la pieza retirada al lote. Las reservas rotas son imposibles, y su montaje automático de emergencia no cobra esa mano de obra.

La reparación recupera estado hasta el límite permitido por original. El costo y el tiempo dependen del daño recuperable y de reparaciones anteriores; se añade un suplemento por avería. Ver las fórmulas de reconstrucción al final. Reparar una reserva no tiene costo de pieza, pero consume horas. Primero se procesan acciones mecánicas financiables y después combustible; por eso gastar todo en reparaciones puede requerir combustible a crédito. La interfaz anticipa el total, y el registro informa omisiones y asistencia.

La carga es un **objetivo mínimo** de litros al salir: no se vacía combustible para alcanzar un objetivo menor. El tanque limita el objetivo. Si el consumo real agota el combustible, un rescate repone combustible para continuar con la penalidad indicada.

## Pronóstico, resultado y clasificación

La estimación del campamento aplica los cambios/reparaciones previstos y la energía de salida, y calcula cada superficie con ese estado inicial. No promete que esas condiciones se mantengan durante toda la etapa. El resultado real integra desgaste y energía cada 30 s, y puede incluir fallos aleatorios.

La meta se registra dentro del último tick usando la distancia restante y la velocidad. La asistencia siguiente comienza en un límite de tick, introduciendo una resolución máxima de 30 s. El orden provisional es por avance; después de llegar se usa el tiempo total exacto registrado. Los premios se acreditan una sola vez. Empates matemáticamente exactos conservan el orden estable de participantes; esa regla debe explicitarse antes de un lanzamiento competitivo.

## Vehículos y base de operaciones (v0.3.3)

Cada unidad del garaje tiene un ID estable, modelo, estado 0–100, performance 50–100, fiabilidad 50–100 y odómetro observado. Un auto nuevo o migrado empieza en 100/50/50. El precio del catálogo incluye la unidad, no piezas adicionales: el kit de seis componentes pertenece al equipo y se usa en el auto elegido. El auto activo sólo se cambia antes de la largada o después de terminar; los demás pueden trabajarse durante la carrera.

Multiplicadores adicionales del auto (`P` performance, `F` fiabilidad, `E` estado):

- Velocidad: `(1 + (P−50)×0,003) × (0,72 + 0,28×E/100)`.
- Riesgo de avería de las piezas: `(1 + (100−E)/100) × (1−(F−50)×0,008)`.
- Desgaste de la estructura: `1−(F−50)×0,004`.
- Pérdida de estado por conducción: `kilómetros/100 × 0,1 × factor de desgaste de la conducción × factor de estructura`. Una salida de pista resta además `demora en horas × 2`. Sólo el auto activo acumula desgaste y kilometraje.

La performance máxima aporta hasta 15% al multiplicador de velocidad; la fiabilidad máxima reduce 40% el multiplicador de riesgo y 20% el desgaste estructural. El resto de factores del motor y los topes de superficie siguen aplicándose. Son relaciones ficticias para balancear el juego.

La reparación del auto recupera estado hasta 100. Cada mejora de performance o fiabilidad agrega hasta 5 puntos sin superar 100. Si `V` es el precio del catálogo, `G` la ganancia y `D = 1 + (valor actual−50)/25`:

| Trabajo | Costo | Horas base |
| --- | --- | --- |
| Reparar estado | `V × 0,003 × G` | `0,6 × G` |
| Mejorar performance o fiabilidad | `V × 0,008 × G × D` | `2 × G × D` |

Costos redondeados hacia arriba. Venta: `floor(V × (0,2 + 0,5×E/100) + V×0,12×((P−50)+(F−50))/100)`. La tasación deja un costo de compra/venta y valora las mejoras; no genera unidades nuevas en el stock. El canje valida stock, propiedad, saldo, fase y capacidad antes de modificar la caja.

## Personal y cola

Carrera admite 1–4 mecánicos, base 0–4 y la escudería hasta 5. El único mecánico inicial queda en carrera. La eficiencia de cada destino es la suma de sus mecánicos: horas reales de trabajo = horas base / eficiencia. La asistencia usa sólo personal de carrera; el taller sólo personal de base. Descanso del piloto y trabajo mecánico siguen transcurriendo en paralelo. El reparto se cambia con el equipo detenido, sin modificar una asistencia en curso.

Hasta 8 trabajos ordenados, uno por objetivo. El presupuesto se descuenta al programar; la cola concentra el personal en el primero. Cero mecánicos en la base significa cero progreso, conservando lo trabajado. Cancelar devuelve `floor(costo × fracción no trabajada)` sin aplicar una mejora parcial. El auto o repuesto queda reservado hasta terminar/cancelar; una pieza señalada como reemplazo en un plan futuro no puede entrar en la cola.

El reloj común avanza los trabajos antes de que finalice cada tick. Un auto en trabajo no sale hasta el siguiente tick disponible tras completarlo. Se mantiene el progreso de garaje y personal al pasar a la siguiente carrera. Las partidas anteriores sin mecánicos se admiten sólo como compatibilidad: no comienzan otra etapa hasta contratar uno.

## Original y reconstrucción de piezas

`original` es independiente del estado, con rango 0–100. Pieza nueva: 100. Las usadas del catálogo comienzan también en 100 porque representan desgaste de uso sin reconstrucciones previas; las piezas migradas reciben 100 al no existir ese historial.

Para original `O`, techo de recuperación = `40 + 0,6×O`; daño recuperable `R = max(0, techo−estado)`. No se reduce el estado si ya supera ese techo. Dificultad `D = 1 + (100−O)/20`.

- Horas base: `(horas del tipo × R/100 + 0,75 si está averiada) × D`.
- Costo: `(precio del tipo × factor de precio de calidad × R/100 × 0,52 + precio del tipo × 0,12 si está averiada) × (1 + (100−O)/100 × 0,6)`, redondeado hacia arriba.
- Al terminar: quitar avería, aplicar el techo calculado y reducir original en 4 puntos; en 7 si había avería. Nunca baja de 0. Sin daño recuperable ni avería no hay trabajo, cobro ni reducción de original.

Ejemplo: una primera reparación con original 100 alcanza estado 100 y deja original 96. Tras nuevo desgaste, el siguiente techo será 97,6; el trabajo por punto recuperado cuesta y tarda más. El techo mínimo es 40 y la dificultad máxima 6. El taller y el campamento comparten exactamente esta fórmula; las reservas conservan su inmunidad a averías.
