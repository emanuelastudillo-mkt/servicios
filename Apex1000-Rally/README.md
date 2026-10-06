# Apex1000 Rally · World Raid v0.4.4

Juego estático para navegador: una escudería y once rivales simulados. Funciona en GitHub Pages o con Node.js, sin instalar dependencias para jugar. Este incremental v0.4.4 se aplica sobre v0.4.3. Admin incorpora Reset total con confirmación y respaldo local. Incluye 48 escudos originales seleccionables y un usuario del director independiente del nombre de la escudería.

## Atributos fijos de vehículos

Velocidad, aceleración, comodidad y control son índices de juego de **0 a 100**. El **peso se expresa en kilogramos** con referencias de fabricantes o mínimos reglamentarios identificados en las fichas. Ver [pesos, fuentes y criterios](docs/PESOS-VEHICULOS.md). Comodidad reduce cansancio, control reduce errores y el peso afecta ritmo, consumo y desgaste. Aceleración aproxima la recuperación de ritmo medio en terreno técnico.

Los atributos aparecen al elegir auto, en Mercado, Taller y el visor, incluida pantalla completa. Son fijos por unidad y distintos del estado, performance y fiabilidad mejorables. Las partidas antiguas incorporan los atributos sin reiniciar dinero ni daños. Las fichas desplegadas conservan su apertura durante las microactualizaciones.

## Carreras e inscripción

Hay ocho raids de 9.300 a 12.600 km con quince etapas y campamentos, y **24 sprints distintos que rotan cada 48 horas**, de 105 a 215 km. El sprint es una experiencia de hasta cuatro horas con un solo piloto, sin paradas, reparaciones ni asistencia en ruta. Su premio es pequeño; los sueldos se pagan mensualmente, igual que en raids. Los raids continúan durante varios días de tiempo real.

Cada carrera tiene largada fija, inscripción individual, premio por posición y un intervalo máximo publicado. No existen puntos ni ranking de campeonato. Inscribirse reserva el auto, el piloto y el intervalo completo; no permite participar en carreras que se superpongan, aunque se termine antes. Se puede cancelar antes de largar. Sin inscripción, el equipo permanece en la base y aprovecha el tiempo para descansar y trabajar en el taller.

La carrera se cierra cuando llegan todos, a las **24 horas de la primera llegada**, o al agotar su tiempo máximo, lo que ocurra primero. Los finalistas se ordenan por tiempo y quienes no terminaron por distancia recorrida. Se pagan premios una sola vez al cerrar, descontando deudas. La Home muestra la siguiente largada, un contador y el acceso a inscripción. El calendario horizontal abarca 30 días y permite centrar la carrera del visor.

Los máximos de los raids se estimaron a 30 km/h, 12 horas de margen por campamento y 10% adicional, redondeados al día: de 552 a 672 horas. Son límites de competencia, no garantías de llegada. `Carreras.maxHours` permite ajustarlos. Las fechas cortas se repiten cada 48 días después de recorrer los 24 circuitos; los ocho raids repiten su calendario cada 224 días.

## Taller y equipo

- Hasta **3 autos**, **3 pilotos y 5 mecánicos**. Vehículo nuevo: estado 100/100, performance 50/100 y fiabilidad 50/100. El estado se deteriora en carrera. Comprar, vender y entregar como parte de pago conserva las piezas del kit del equipo.
- Se puede vender el auto seleccionado y el último fuera de una carrera en curso. Las inscripciones futuras que usen un auto vendido se cancelan. Sin auto no se puede inscribir el equipo.
- Mejoras de performance y fiabilidad de **1 a 5 puntos elegibles**, hasta 100. Empiezan en 20 horas de trabajo por punto, al menos diez veces el tiempo anterior, y crecen exponencialmente al aumentar el nivel. La cantidad y eficiencia de mecánicos reducen la espera real.
- Carrera: 1–4 mecánicos para participar. Taller: 0–4. Máximo total: 5. Sin participación o después de terminar, se permite dejar cero en carrera. Con cero en taller su cola se pausa sin perder avance. Hasta ocho trabajos en cola; se pagan al programar. Cancelar devuelve sólo el costo del trabajo pendiente y no aplica una mejora parcial.
- Los lotes de repuestos se reparan en la base. “Original” empieza en 100 y disminuye con cada reparación: progresivamente aumentan el tiempo y costo y baja el estado máximo recuperable. Las piezas reservadas en planes deben liberarse antes de trabajar sobre ellas.
- Energía ajustada para que 100% normalmente alcance una etapa. Los otros pilotos recuperan a **0,1× durante el trayecto** y a **1× en campamento/base**. Exigencia alta, averías y errores pueden producir fatiga adicional.
- Catálogo: siete vehículos, 54 repuestos, 16 pilotos y 28 mecánicos. Se suman 20 mecánicos, 10 pilotos y LADA Niva Legend · Raid, Prodrive Hunter T1+ y Audi RS Q e-tron. Ofertas por personal con cierre, adjudicación y exclusividad dentro de la simulación; tres perfiles de piloto con ventajas y riesgos diferentes.

Los sueldos y gastos fijos se liquidan el día 1 de cada mes a las 00:00 ART, también sin inscripción. Los contratos duran 12 meses calendario, renovables con un sueldo ajustado al cambio de nivel de la escudería. El personal añade edad, forma, moral y especialidades por superficie, modelo o pieza. Finanzas muestra caja, próximo cobro, gasto por categoría y evolución del saldo. Ver [reglas de economía y personal](docs/ECONOMIA-PERSONAL.md). El presupuesto inicial y los premios se leen del catálogo. Las finanzas registran transacciones; el nivel tiene una curva exigente y decaimiento por malos resultados e inactividad. Los hitos de la Home son informativos y no agregan premios.

## Carrera y visor

En Campamento se guarda un plan por etapa: piloto, ritmo, exigencia, suspensión, neumáticos, transmisión, refrigeración, combustible y reparaciones o cambios de piezas. En raids, el trabajo y el descanso se hacen en paralelo; el checklist explica qué está completo, pendiente, omitido o demorando la salida. La etapa comienza al completar la tarea más larga. Los planes futuros pueden prepararse anticipadamente.

Las reservas precarias gratuitas nunca se averían, pero pierden rendimiento con el desgaste. En raids, una asistencia por falta de combustible agrega cuatro horas y un recargo; en sprints el auto sin combustible queda detenido hasta el cierre. No se repara en ruta durante un sprint.

El mapa muestra un trazado deportivo detallado entre localidades reales, escudos y posiciones. Permite pantalla completa, seguimiento y **zoom de hasta 2000×**. El panel ofrece posición, distancias al anterior/siguiente, vehículo, conductor, combustible, energía y estado de piezas. Las averías graves parpadean en rojo; riesgos elevados se muestran en amarillo. Los controles conservan selección y foco mientras se actualiza la telemetría.

El tablero tiene velocidad real de simulación, agujas animadas, RPM y marcha arcade, combustible, temperatura y testigos. Las RPM no cambian la física. La bitácora registra una o dos observaciones por etapa a partir de los hechos y ofrece consejos de preparación. No inventa notas de etapas antiguas.

## Catálogo diario en Google Sheets

Editá [Apex1000-Catalogos (v0.4.2)](https://docs.google.com/spreadsheets/d/1RnlQEN6uLO1nxxxXP74Q2sl1AGmUrqwsk1MpJuOF3qk/edit). Sus siete pestañas de datos se publican en CSV para el importador. Vehiculos agrega `speed`, `acceleration`, `comfort`, `control`, `weightKg`. Pilotos/Mecanicos añaden `age`, `form`, `morale` y `traits`; Ajustes añade `monthlyBaseCost`. La pestaña Guia explica los campos y referencias de peso. El respaldo previo queda en `catalogos/Respaldo-Catalogos-v0.4.1-antes-v0.4.2.xlsx`.

Al subir el incremental a GitHub, `config/sheets.json` conecta el formato nuevo de la misma planilla. El workflow existente en la raíz de `servicios` consulta y valida los datos cada día a las **07:23 de Argentina**, actualiza `data/catalog.json` y `data/catalog.js` y verifica su publicación. Un catálogo inválido no reemplaza al válido. GitHub y Google pueden demorar la ejecución/publicación. Ver [instrucciones](docs/CATALOGOS.md).

**Las partidas existentes conservan su catálogo**: los cambios diarios se incorporan en partidas nuevas. No se alteran compras, contratos, stock o premios de una partida en curso.

## Jugar y aplicar el incremental

Con Node.js 22 o superior: `node server.mjs`; abrir http://127.0.0.1:4182. También se puede alojar la carpeta en un servidor estático. No abrir `index.html` con `file://`: el juego utiliza módulos y Web Worker.

1. Elegí vehículo, nombre, escudo y horario del calendario de prueba. Se entregan tres pilotos y una mecánica. Se paga el auto; los sueldos se devengan y liquidan el día 1.
2. Abrí Inscripción y elegí un raid o sprint antes de su largada. Prepará el plan y comprobá el intervalo reservado.
3. Usá 1× para tiempo real. En el prototipo, Admin permite acelerar, saltar a la largada, avanzar horas, llegar a la próxima parada y pasar a una carrera futura. “Próxima carrera” no inscribe por sí solo.
4. Admin permite inyectar de 1 a 10.000.000 cr para pruebas, con registro en finanzas y saldo máximo de 100.000.000 cr. No es una función de economía online.
5. Exportá la partida para respaldarla. Al migrar, se conserva un respaldo local de la versión anterior. Una sesión acelerada se reabre pausada.

Para aplicar el ZIP sobre v0.4.3, descomprimí en la raíz de `servicios`, conservando `Apex1000-Rally/`, y reemplazá sólo los archivos incluidos. No borres el resto. Commit y push a GitHub; después recargá con Ctrl+F5. No se publicó el juego automáticamente como parte de esta entrega. Ver [notas completas](INCREMENTAL-v0.4.4.md). `qa/` contiene verificaciones y respaldos locales y no debe subirse.

## Validación y alcance

`npm test` ejecuta la suite del motor, energía, finanzas, mercado, contratos, taller, migraciones, guardado, catálogos, cierres, intervalos, sprints, visor, bitácora, Admin, tablero y checklist. Si no hay npm instalado, ejecutá el comando Node indicado en `package.json`. `node scripts/sync-catalog.mjs --source-dir catalogos --check` valida los CSV locales; sin `--source-dir`, usa Sheets. `--check` no modifica el catálogo.

Los modelos y localidades son reales; rutas deportivas, distancias, terreno, precios, sueldos, premios y rendimiento comparativo son balance ficticio. No reproduce el reglamento Dakar ni navegación vial. El Audi usa combustible y las seis piezas comunes del juego como simplificación de su convertidor; no simula una batería. Las imágenes son ilustraciones generadas, no fotografías oficiales. Los 30 personajes nuevos son ficticios con estética fotográfica documental. Los prompts de las 33 imágenes nuevas están en `assets/art/prompts-v0.4.0.json`.

**Todavía es single player.** Sólo se simula la carrera del visor; las inscripciones propias pueden activar una carrera futura a su hora. No ejecuta a la vez todos los eventos del calendario ni contrata entre usuarios reales. `src/worker.js` es un worker del navegador. El servidor online deberá controlar identidad, reloj compartido, cada carrera concurrente, finanzas, estado y adjudicación de personal. Ver `docs/ONLINE.md` y `docs/ONLINE-MERCADO.md`.

## Nivel de escudería

La Home muestra nivel, experiencia y progreso al siguiente nivel. El umbral del nivel siguiente es `100 × nivel^2,4` XP: cada nivel cuesta más que el anterior. Un raid completado entrega entre +400 XP (P1) y −65 XP (P12); un sprint usa el 7,5% de esos valores. Un raid incompleto resta hasta 80 XP según el avance, proporcionalmente menos en un sprint. La experiencia nunca baja de cero y el nivel mínimo es uno.

Hay 72 horas de gracia desde la última participación; después, la experiencia decae un 1% diario si el equipo no está en una carrera participante en curso. Los malos resultados y la inactividad pueden bajar el nivel. La acreditación se hace una sola vez al cerrar. Las partidas antiguas que no tenían este dato comienzan en nivel uno: no se inventa experiencia histórica.

Si una partida anterior ya había superado el nuevo plazo de cierre, se cierra al primer avance con el progreso guardado; no se reconstruyen posiciones históricas anteriores al guardado.

La planilla conectada ya usa el formato v2. Hasta subir el incremental, el importador anterior de GitHub rechazará la nueva estructura sin reemplazar el catálogo válido ni alterar el juego publicado. Aplicar los archivos del ZIP y ejecutar el workflow recupera la sincronización con el catálogo nuevo. La copia privada preparada durante la edición no se usa como fuente.
