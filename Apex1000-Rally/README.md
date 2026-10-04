# Apex1000 Rally — World Raid v0.3.5

Juego estático para navegador, single player, con 11 equipos rivales simulados. Se ejecuta en GitHub Pages o con `node server.mjs` y no necesita instalar dependencias para jugar.

## Esta entrega

El incremental v0.3.5 incorpora un **tablero de instrumentos** en el visor y en el panel del equipo seleccionado: velocímetro con la velocidad de simulación, cuentavueltas arcade, combustible, temperatura, recorrido y nueve testigos. Las RPM y la marcha son ilustrativas; no cambian la física ni el avance. Las agujas acompañan los valores, el motor queda a cero RPM en campamento y se respeta la preferencia de movimiento reducido.

Las paradas muestran un **checklist con tareas completadas, en curso, pendientes y omitidas**, progreso y tiempo hasta la salida. Incluye reparación, cambio, montaje de reserva, carga de combustible, asistencia por falta de fondos y descanso. El panel explica qué determina la demora y qué mejorar en la próxima parada. El auto sale automáticamente con el reloj activo cuando vence el plazo real de la asistencia. Las partidas antiguas conservan su salida y muestran un resumen si la parada comenzó antes de esta versión.

El incremental v0.3.4 amplía el zoom máximo de **120× a 2000×**, conserva los desplegables de seguimiento mientras se actualiza la telemetría y agrega **Inyectar dinero a tu equipo** en Admin. Elegí un importe entero de 1 a 10.000.000 cr; el ingreso se guarda y aparece identificado en las finanzas. El saldo máximo es 100.000.000 cr. La función se bloquea fuera del modo single player y cuando Admin está desactivado.

Los cambios de etapa que necesitan reconstruir la pantalla se aplazan mientras editás un control. El reloj, los escudos, los rivales y los datos del visor siguen actualizándose. Al salir del control, la siguiente actualización completa la pantalla pendiente. Escape sobre un control ya no cierra el modo ampliado del mapa por el manejador del juego.

El incremental v0.3.3 agrega **Home y Taller**. La Home reúne próxima largada, presupuesto, deuda, progreso e hitos de seguimiento. El taller admite **hasta 3 autos**, compra, venta y entrega como parte de pago. Cada unidad conserva su propio estado, performance, fiabilidad y kilometraje.

- Auto nuevo: **estado 100/100, performance 50/100 y fiabilidad 50/100**. Las mejoras suben de a 5, hasta 100, con costo y tiempo crecientes. El estado se deteriora en carrera y se repara en la base.
- Mecánicos: **1–4 en carrera y 0–4 en el taller, máximo 5 en total**. Con cero en la base los trabajos quedan pausados sin perder avance. Se mantiene un único mecánico inicial; no se regala otro.
- Cola de hasta 8 trabajos: reparar autos, mejorar performance/fiabilidad o reparar repuestos del lote. Todos los mecánicos de la base trabajan en una tarea a la vez.
- Las piezas tienen **original**, que empieza en 100 y baja con cada reparación. Cada reconstrucción posterior es más lenta y recupera menos estado. El efecto se aplica tanto en campamento como en el taller.
- Partidas anteriores migradas y respaldadas, sin perder caja, vehículos ni recorrido. Ver las excepciones de compatibilidad en INCREMENTAL-v0.3.3.md.

**Reglas de competición pendientes:** aún se mantiene el campeonato con puntos. Carreras independientes, inscripción por carrera, corte a las 24 horas del primer finalista y progresión de nivel con decaimiento requieren la siguiente entrega. La Home muestra fechas y cuenta regresiva del calendario actual; los hitos son indicadores, sin pagos adicionales.

La barra Admin se adapta a móvil y pantalla completa. “Próxima carrera” se habilita cuando todos los equipos terminaron, según las reglas actuales; “+24 horas” permite avanzar mientras se espera. Para ocultar toda la barra, configurar `ADMIN_ENABLED = false` en `src/admin-ui.js`; se bloquean los controles de avance del prototipo y se usa el reloj a 1×. Esto no reemplaza la autoridad de un servidor futuro.

## Visor y funciones existentes

El visor conserva el zoom hasta 2000×, escudos de tamaño constante, posición y distancias al anterior/siguiente, alertas rojas pulsantes por averías y amarillas por riesgo elevado. Las 120 etapas tienen curvas y desvíos de diseño. Los vehículos recorren la misma geometría que se dibuja; los kilómetros deportivos y el balance de simulación se conservan.

Para acercar: botones, rueda sobre el punto de interés o deslizador de 1× a 2000×. “Seguirme” enfoca al equipo a 12× y conserva aumentos mayores; “Ver ruta” vuelve a la vista general. Los escudos muestran el puesto. En pantalla completa, el panel detalla los kilómetros de separación según el orden de carrera; si ambos equipos terminaron, también indica la diferencia de tiempo.

La alerta amarilla de pieza aparece desde un 8% estimado de avería en la próxima hora de conducción. Usa la fórmula real del simulador y supone estado, exigencia y temperatura constantes; no es una garantía del resultado. Las reservas mantienen riesgo de avería cero. Temperatura superior a 112 °C activa aviso amarillo y superior a 122 °C activa rojo. Las averías existentes se señalan en rojo. La animación respeta la preferencia de movimiento reducido del dispositivo.

Los trazados detallados son especiales ficticias entre localidades reales; no son carreteras verificadas. Colores: azul para asfalto, ocre para ripio, amarillo para arena, coral para piedras y verde para montaña.

- Campeonato de 8 carreras y 120 etapas, entre 9.300 y 12.600 km por carrera. Primera prueba: Andes, 10.240 km. Largadas compartidas y fijas, con descanso y avance independientes por equipo.
- 4 vehículos reales ilustrados; 54 ofertas de piezas nuevas y usadas con precio y stock. Las piezas y los autos adquiridos se conservan durante el campeonato.
- 6 pilotos y 8 mecánicos ficticios en el catálogo. Máximo 3 pilotos y 5 mecánicos por equipo. Ofertas temporizadas, depósito, devolución, salario por carrera y titularidad exclusiva dentro de la partida.
- 100 escudos, nombre de equipo editable y 24 imágenes originales generadas con IA, optimizadas en WebP.
- Mapa mundial local, seguimiento de rivales, zoom y pantalla completa con vehículo, piloto, combustible, temperatura y piezas.
- Guardados anteriores v0.2 migrados, conservando avance, presupuesto y piezas. Se conserva un respaldo local previo a la migración.
- Catálogo administrativo: XLSX con guía y 7 hojas, CSVs, importador validado y workflow de GitHub preparado.

**Catálogo diario:** editar [Apex1000-Catalogos en Google Sheets](https://docs.google.com/spreadsheets/d/1RnlQEN6uLO1nxxxXP74Q2sl1AGmUrqwsk1MpJuOF3qk/edit). GitHub Actions descarga y valida las siete hojas cada día a las 07:23 de Argentina, actualiza el catálogo y verifica su publicación en Pages. `config/sheets.json` está conectado a las siete URLs reales. Ver [instrucciones](docs/CATALOGOS.md). Los cambios se aplican a partidas nuevas; cada partida existente conserva su copia.

## Jugar localmente

Con Node.js 22 o superior: `node server.mjs`. Abrir http://127.0.0.1:4182. No abrir `index.html` directamente con `file://`, porque utiliza módulos ES y un Web Worker.

1. Elegir vehículo, nombre y largada. La inscripción incluye tres pilotos y una mecánica; se descuentan vehículo y primeros sueldos.
2. En Home, consultar la próxima largada. En Taller, elegir el auto activo y repartir mecánicos antes de salir. Contratar personal adicional permite trabajar en la base mientras se corre. En Equipo, elegir escudo. Para contratar otro piloto primero hay que liberar un cupo; se necesita al menos un piloto.
3. En Mercado, comprar o enviar ofertas. El plazo inicial es de seis horas del reloj de simulación. Ganar paga el primer sueldo con el depósito; perder o cancelar lo devuelve.
4. En Roadbook, estudiar terreno, temperatura y distancias. Campamento permite guardar el plan de cada etapa. Se pueden completar automáticamente los planes faltantes.
5. En la barra Admin, usar el reloj o “Próxima parada”. El mapa permite seguir cualquier participante y entrar en pantalla completa; Escape cierra esa vista. Bitácora muestra las observaciones de las etapas recorridas desde la actualización.
6. Al llegar todos a meta, Campeonato cierra los puntos y se habilita “Próxima carrera” en Admin. Se cobran los siguientes sueldos. Los premios de temporada se pagan una sola vez tras la octava prueba; este sistema sigue vigente hasta la próxima modificación.

## Publicación e incremental

El incremental **v0.3.5 requiere v0.3.4**. Descomprimir en la raíz del repositorio `servicios`, conservando la carpeta `Apex1000-Rally/`, y agregar o reemplazar sólo los archivos incluidos. No borrar los demás. Este ZIP no incluye cambios en workflows ni en la conexión de Sheets. Después de subirlo, recargar con Ctrl+F5. Ver `INCREMENTAL-v0.3.5.md` para el contenido y los límites de esta entrega.

Para subir la carpeta completa, conservar `src/`, `data/`, `assets/`, `style.css` e `index.html`. La carpeta `qa/` contiene respaldos y verificaciones locales y no debe publicarse. No se eliminaron los archivos de QA que ya existían en la versión publicada.

## Validación

`npm test` ejecuta 73 pruebas con la integración de catálogo diario instalada (72 sin ese incremental): simulación, desgaste, energía, presupuesto, ocho carreras, premios, contratos, reservas, stock, migración, lectura CSV, catálogo, visor, bitácora, garaje, taller, inyección Admin, instrumentos y cronogramas de parada. `npm run catalog:check` valida los CSV locales sin modificar el catálogo. No se requieren dependencias npm para estas pruebas. El incremental v0.3.5 se verifica aplicado sobre una copia de v0.3.4, además de revisar el tablero y las paradas en Chrome.

## Alcance

Modelos de vehículos y localidades reales; rendimiento comparativo, salarios, stock, precios, premios, condiciones de terreno y rutas deportivas son parámetros ficticios. Las imágenes son ilustraciones generadas, no fotografías oficiales. Los retratos representan personajes inventados. No se reproduce el reglamento Dakar ni se ofrece navegación vial.

`src/worker.js` pertenece al navegador. La arquitectura del servidor futuro se documenta en `docs/ONLINE.md` y `docs/ONLINE-MERCADO.md`; no hay multijugador, login ni adjudicación entre jugadores reales en esta versión.
