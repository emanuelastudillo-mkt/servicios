# Coordinación por eventos

D1 conserva el mundo, resultados, movimientos contables, usuarios y passkeys. Un
Durable Object SQLite (`ROOM`, clase `RaceRoom`) coordina todas las peticiones API
y programa una alarma persistente para el siguiente evento. No se agrega un plan
pago, ni se crea otra D1, ni se reinician las partidas.

El coordinador anticipa el siguiente cambio mediante el mismo motor, semilla y
pasos de 30 segundos. No se elimina el desgaste, las averías, el combustible,
los errores, la energía ni la curva oculta de ritmo. La predicción no modifica
el mundo real ni se envía al navegador. Nuevos equipos no consumen el RNG de
otros autos. Las decisiones de cada etapa se bloquean al salir; se pueden
cambiar en el campamento. Forma y moral para el ritmo se fijan al largar esa
etapa: una renovación de contrato durante el trayecto beneficia la siguiente.

Se persiste al cambiar de etapa/fase, cerrar una carrera, terminar un trabajo,
vencer una oferta o contrato, liquidar sueldos o ejecutar una acción del jugador.
El cierre sigue respetando el máximo de la carrera y las 24 horas desde el primer
finisher. Los premios y sueldos mantienen las transacciones e idempotencia D1.

Mientras la sala permanece en memoria, las consultas del visor avanzan el estado
reproducible según la hora del servidor sin leer o escribir el mundo en D1.
Al reiniciarse reconstruye desde el último evento guardado, sin perder progreso.
Las consultas autenticadas todavía validan la sesión en D1. Los rankings y el
histórico contable siguen leyendo sus tablas. No equivale a cero peticiones:
cada navegador visible conserva una consulta cada 60 segundos y pausa oculto.

Sin jugadores conectados, la alarma actúa en la fecha prevista; sin carreras ni
trabajos, se salta directamente al evento siguiente. Se eliminó el cron de cada
minuto. Se conserva una recuperación diaria a las 00:00 UTC y limpieza diaria
de sesiones/desafíos vencidos. La fecha de juego continúa avanzando aunque
D1 no reciba una escritura cada minuto.

Una interrupción prolongada se recupera en tramos acotados. Si aún hay atraso,
la API devuelve 503 y se programa otro intento; no aplica acciones al pasado.
Las alarmas duplicadas y los conflictos de revisión no duplican pagos.

## Instalación

`npm run deploy` compila y publica. Wrangler aplica la migración no destructiva
`v1-room-events`, creando sólo el coordinador SQLite. No hay nueva migración SQL
para D1. Conservar `SEASON_EPOCH`, identificadores, sesiones y base existentes.
La primera petición `/api/health` inicializa la alarma; la recuperación diaria
también puede inicializarla. Health informa `scheduler: events` y `nextEventAt`.

La beta offline permanece separada. No publicar `.dev.vars`, `.env`, archivos de
QA o dependencias. Los límites gratuitos son compartidos por la cuenta; revisar
métricas reales antes de aumentar la sala.
