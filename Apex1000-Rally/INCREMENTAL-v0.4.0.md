# Apex1000 Rally · incremental v0.4.0

Base requerida: **v0.3.5 completa**. Descomprimí el ZIP en la raíz del repositorio `servicios`, conservando `Apex1000-Rally/`, y reemplazá únicamente los archivos incluidos. No borres los demás. Subí los cambios a GitHub y recargá el juego con Ctrl+F5.

## Carreras independientes

- Ocho raids de varios días y 24 circuitos cortos distintos que rotan cada **48 horas**. Cada sprint tiene una etapa, un solo piloto, hasta cuatro horas, sin paradas, reparaciones ni asistencia en ruta.
- Inscripción antes de cada largada compartida. Sin inscripción, el equipo permanece en la base: descansan los pilotos y trabaja el taller.
- Cada inscripción reserva el auto, el piloto y todo el intervalo máximo publicado; una llegada anticipada no libera el intervalo para otra carrera superpuesta. Se puede cancelar antes de largar. Vender o entregar el auto cancela sus inscripciones futuras.
- Cierre al llegar todos, a las 24 horas desde la primera llegada o al vencer el máximo, lo que ocurra primero. Finalistas por tiempo; pendientes por distancia. Los premios se liquidan una sola vez al cerrar.
- Calendario horizontal de 30 días, centrado en la carrera del visor, con contador, anteriores, siguientes y resultados individuales. Se eliminaron los puntos y premios de campeonato de la interfaz y del catálogo nuevo.

## Taller, energía y mercado

- Venta del auto seleccionado e incluso del último fuera de una carrera en curso. El equipo puede quedar sin vehículos; necesita comprar uno para inscribirse.
- Performance y fiabilidad permiten **1 a 5 puntos por trabajo**, hasta 100. Tiempo de trabajo: `20 × puntos × dificultad × 1,5^((nivel−50)/10)`. Es al menos diez veces el anterior y aumenta mucho al acercarse a 100. La velocidad final depende de los mecánicos asignados a la base.
- Se mantienen los trabajos antiguos con su costo y duración originales. Cero mecánicos en taller pausa su avance. Sin participación se pueden asignar todos a la base, respetando cuatro por destino y cinco en total.
- Fatiga normal ajustada para que 100% alcance casi siempre una etapa. Un relevo recupera a 0,1× durante el trayecto y a 1× en campamento/base. Averías, exigencia y mala preparación todavía pueden agotar al conductor.
- **20 mecánicos y 10 pilotos nuevos**, todos ficticios, con retratos de aspecto natural. Se mantienen los límites de tres pilotos y cinco mecánicos y las ofertas exclusivas dentro de la simulación.
- **LADA Niva Legend · Raid**, **Prodrive Hunter T1+** y **Audi RS Q e-tron**: opción económica y lenta, y dos opciones de élite. Sus precios y características comparativas son balance ficticio. El Audi usa el sistema simplificado de combustible y piezas del juego; no simula su batería.

## Planilla y sincronización

Catálogo nuevo: [Apex1000-Catalogos (v0.4.0)](https://docs.google.com/spreadsheets/d/1RnlQEN6uLO1nxxxXP74Q2sl1AGmUrqwsk1MpJuOF3qk/edit). Se conserva un respaldo XLSX de la planilla anterior en `catalogos/Respaldo-Catalogos-v0.3.5-antes-v0.4.0.xlsx`. Se preservaron los precios, sueldos, disponibilidad, repuestos, premios de raid y ajustes que estaban editados en la fuente.

El ZIP incluye la configuración actualizada en `config/sheets.json`, el importador para catálogo v2 y los datos verificados. **La sincronización del formato v2 se habilita al subir este incremental**; el workflow ya instalado en la raíz del repositorio continúa sincronizando diariamente a las 07:23 de Argentina. Google y GitHub pueden demorar la publicación y la ejecución. Las partidas guardan una copia del catálogo: los cambios diarios se aplican a partidas nuevas, sin recalcular contratos, premios o compras de partidas anteriores.

`Carreras.maxHours` se estimó con `ceil((km/30 + etapas×12) × 1,1 / 24) × 24`: circulación lenta, margen de campamento y 10% adicional, redondeado al día. Los raids tienen entre 552 y 672 horas máximas. El sprint conserva el límite estricto de cuatro horas. Podés editar el máximo dentro de los límites validados del catálogo.

## Migración y alcance

La partida anterior se respalda automáticamente antes de migrar a inscripciones. Se conserva el saldo, los daños, el lote, la flota, los contratos y los trabajos pendientes. La carrera antigua en curso continúa inscripta. Las carreras futuras requieren inscripción; no se reparten nuevamente premios ya registrados. El formato de guardado v3 sigue siendo compatible.

Se mantienen zoom 2000×, selección estable de equipos, escudos, tablero con velocidad real de simulación y RPM arcade, testigos, checklist de paradas, bitácora, finanzas, nivel y controles Admin.

Es **single player con once rivales simulados**. El calendario y las inscripciones están preparados para un servidor futuro, pero el prototipo sólo simula la carrera del visor y las inscripciones del jugador. No es un backend concurrente de todas las carreras. No agrega login ni exclusividad entre usuarios reales. Admin acelera el reloj, cambia a una prueba futura e inyecta dinero sólo en el prototipo.

## Revisión

El paquete incluye un manifiesto SHA-256 de los archivos nuevos y modificados. Se verifican el motor, los cierres reales, los solapamientos, los sprints, el taller, la migración y el guardado; también se aplica el ZIP sobre una copia completa de v0.3.5 y se ejecutan allí las pruebas. Los controles y las vistas se revisan en Chrome.

Las 33 imágenes nuevas se generaron con la herramienta integrada `image_gen`. Están en `assets/art/`; sus prompts se conservan en `assets/art/prompts-v0.4.0.json`. Las personas no representan identidades reales. Las referencias del usuario se usaron para definir la estética documental.

## Nivel de escudería

La Home muestra nivel, experiencia y progreso al siguiente nivel. El umbral del nivel siguiente es `100 × nivel^2,4` XP: cada nivel cuesta más que el anterior. Un raid completado entrega entre +400 XP (P1) y −65 XP (P12); un sprint usa el 7,5% de esos valores. Un raid incompleto resta hasta 80 XP según el avance, proporcionalmente menos en un sprint. La experiencia nunca baja de cero y el nivel mínimo es uno.

Hay 72 horas de gracia desde la última participación; después, la experiencia decae un 1% diario si el equipo no está en una carrera participante en curso. Los malos resultados y la inactividad pueden bajar el nivel. La acreditación se hace una sola vez al cerrar. Las partidas antiguas que no tenían este dato comienzan en nivel uno: no se inventa experiencia histórica.

Si una partida anterior ya había superado el nuevo plazo de cierre, se cierra al primer avance con el progreso guardado; no se reconstruyen posiciones históricas anteriores al guardado.

La planilla conectada ya usa el formato v2. Hasta subir el incremental, el importador anterior de GitHub rechazará la nueva estructura sin reemplazar el catálogo válido ni alterar el juego publicado. Aplicar los archivos del ZIP y ejecutar el workflow recupera la sincronización con el catálogo nuevo. La copia privada preparada durante la edición no se usa como fuente.
