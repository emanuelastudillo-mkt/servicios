# Modelo estratégico v0.2

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

La reparación cuesta una fracción del valor nuevo por desgaste, más un suplemento si está averiada. El trabajo es proporcional al daño. Reparar una reserva no tiene costo de pieza, pero consume horas. Primero se procesan acciones mecánicas financiables y después combustible; por eso gastar todo en reparaciones puede requerir combustible a crédito. La interfaz anticipa el total, y el registro informa omisiones y asistencia.

La carga es un **objetivo mínimo** de litros al salir: no se vacía combustible para alcanzar un objetivo menor. El tanque limita el objetivo. Si el consumo real agota el combustible, un rescate repone combustible para continuar con la penalidad indicada.

## Pronóstico, resultado y clasificación

La estimación del campamento aplica los cambios/reparaciones previstos y la energía de salida, y calcula cada superficie con ese estado inicial. No promete que esas condiciones se mantengan durante toda la etapa. El resultado real integra desgaste y energía cada 30 s, y puede incluir fallos aleatorios.

La meta se registra dentro del último tick usando la distancia restante y la velocidad. La asistencia siguiente comienza en un límite de tick, introduciendo una resolución máxima de 30 s. El orden provisional es por avance; después de llegar se usa el tiempo total exacto registrado. Los premios se acreditan una sola vez. Empates matemáticamente exactos conservan el orden estable de participantes; esa regla debe explicitarse antes de un lanzamiento competitivo.
